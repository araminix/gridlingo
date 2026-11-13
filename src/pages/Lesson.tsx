import { Binary, Lightbulb, ListTree } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n, type MessageKey } from "@/i18n/i18n";
import { GroupIcon, groupVars } from "@/layout/GroupIcon";
import { ProtocolNav } from "@/layout/ProtocolNav";
import { metaOf } from "@/lessons/catalog";
import { loadGlossary, type Glossary } from "@/glossary/glossary";
import { GlossaryProvider, Rich } from "@/glossary/Rich";
import { loadLesson, type Loaded } from "@/lessons/load";
import type { Frame, Meta } from "@/lessons/types";
import { wordsOf, type Words } from "@/lessons/words";
import { Encoder } from "@/playground/Encoder";
import { PilotDuty } from "@/playground/PilotDuty";
import { SampleFile } from "@/playground/SampleFile";
import { SclExplorer } from "@/playground/SclExplorer";
import { finish } from "@/progress";
import { Link } from "@/router";
import { usePersisted } from "@/settings";
import { ByteInspector, frameSize } from "@/viz/ByteInspector";
import { DeviceState } from "@/viz/DeviceState";
import { FrameList } from "@/viz/FrameList";
import { NameAnatomy } from "@/viz/NameAnatomy";
import { SequenceDiagram } from "@/viz/SequenceDiagram";
import { SingleLine } from "@/viz/SingleLine";
import { SiteScene } from "@/viz/SiteScene";
import { StepCaption, StepControls, StepStrip } from "@/viz/StepPlayer";
import { TimingChart } from "@/viz/TimingChart";
import { NotFound } from "./NotFound";

const PLAY_EVERY_MS = 2600;

export function LessonPage({ id }: { id: string }) {
    const { lang, t } = useI18n();
    const meta = metaOf(id);
    const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
    const [glossary, setGlossary] = useState<Glossary>({});

    useEffect(() => {
        let current = true;
        void loadLesson(id, lang).then((result) => current && setLoaded(result));
        void loadGlossary(lang).then((result) => current && setGlossary(result));
        return () => {
            current = false;
        };
    }, [id, lang]);

    useEffect(() => {
        if (meta) document.title = `${meta.name} · Gridlingo`;
        return () => {
            document.title = "Gridlingo";
        };
    }, [meta]);

    if (!meta || loaded === null) return <NotFound />;
    if (!loaded) return <main id="main" className="min-h-[60vh]" aria-busy="true" aria-label={t("lesson.loading")} />;
    return (
        <GlossaryProvider glossary={glossary}>
            <Workspace key={id} meta={meta} loaded={loaded} />
        </GlossaryProvider>
    );
}

function Section({ title, hint, children, action, testId }: { title: string; hint?: string | undefined; children: ReactNode; action?: ReactNode; testId?: string }) {
    return (
        <Card className="gap-0 overflow-hidden py-0" data-testid={testId}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 [.border-b]:pb-2.5">
                <div className="space-y-1">
                    <h2 className="text-base leading-none font-semibold">{title}</h2>
                    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                </div>
                {action}
            </CardHeader>
            <CardContent className="p-0">{children}</CardContent>
        </Card>
    );
}

// Wide screens have a right-hand column: the introduction goes at its top; on narrower ones it follows the diagram.
// It is mounted in one place only, so its text is never on the page twice.
const wideQuery = () => (typeof matchMedia === "function" ? matchMedia("(min-width: 80rem)") : null);
const subscribeWide = (onChange: () => void) => {
    const query = wideQuery();
    query?.addEventListener("change", onChange);
    return () => query?.removeEventListener("change", onChange);
};
const useWide = () => useSyncExternalStore(subscribeWide, () => wideQuery()?.matches ?? false, () => false);

/** How the lesson is introduced: in the trade's words, or in plain ones. */
type Level = "technical" | "plain";
const isLevel = (value: unknown): value is Level => value === "technical" || value === "plain";

function Workspace({ meta, loaded }: { meta: Meta; loaded: Loaded }) {
    const { t, dir } = useI18n();
    const { lesson } = loaded;
    const words = useMemo(() => wordsOf(loaded.text, loaded.english), [loaded]);
    const [current, setCurrent] = useState(0);
    const [chosen, setChosen] = useState<string | undefined>(undefined);
    const [playing, setPlaying] = useState(false);
    const [navOpen, setNavOpen] = useState(false);
    const [level, setLevel] = usePersisted<Level>("gridlingo.level", "technical", isLevel);
    const wide = useWide();
    const last = lesson.steps.length - 1;

    const stepIndex = useCallback((frame: Frame) => lesson.steps.findIndex((step) => step.id === frame.step), [lesson]);
    const shownFrames = lesson.frames.filter((frame) => stepIndex(frame) <= current);
    const stepFrames = shownFrames.filter((frame) => stepIndex(frame) === current);
    const selected = shownFrames.find((frame) => frame.id === chosen) ?? stepFrames.at(-1) ?? shownFrames.at(-1);

    const go = useCallback(
        (index: number) => {
            const next = Math.max(0, Math.min(last, index));
            setCurrent(next);
            setChosen(undefined);
            if (next === last) finish(meta.id);
        },
        [last, meta.id],
    );

    useEffect(() => {
        if (!playing) return;
        if (current >= last) {
            setPlaying(false);
            return;
        }
        const timer = setTimeout(() => go(current + 1), PLAY_EVERY_MS);
        return () => clearTimeout(timer);
    }, [playing, current, last, go]);

    // The arrow keys move between steps (mirrored in right-to-left languages), unless a field or a menu has the focus
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (event.altKey || event.ctrlKey || event.metaKey || (target && (target.isContentEditable || target.closest("input, textarea, select, [role=listbox], [role=menu], [role=dialog], [role=tablist]")))) return;
            const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
            const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
            if (event.key !== forward && event.key !== back) return;
            event.preventDefault();
            setPlaying(false);
            go(current + (event.key === forward ? 1 : -1));
        };
        addEventListener("keydown", onKey);
        return () => removeEventListener("keydown", onKey);
    }, [current, dir, go]);

    const togglePlay = () => {
        if (playing) return setPlaying(false);
        if (current >= last) go(0);
        setPlaying(true);
    };

    const wire = selected && `${selected.name} · ${words.device(selected.from)} → ${(typeof selected.to === "string" ? [selected.to] : selected.to).map((to) => words.device(to)).join(", ")}`;
    const facts = <Facts meta={meta} words={words} keys={lesson.facts} />;
    // What the protocol is for, in the trade's words or in plain ones, as the reader picks
    const intro = (
        <Card className="gap-0 overflow-hidden py-0">
            <Tabs value={level} onValueChange={(value) => isLevel(value) && setLevel(value)} className="gap-0">
                <div className="border-b px-3 py-2">
                    <TabsList className="w-full">
                        <TabsTrigger value="technical">
                            <Binary aria-hidden="true" />
                            {t("lesson.technical")}
                        </TabsTrigger>
                        <TabsTrigger value="plain">
                            <Lightbulb aria-hidden="true" className="text-gold-foreground" />
                            {t("lesson.plain")}
                        </TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="technical" className="p-3">
                    <p className="text-[15px]">
                        <Rich text={words.intro} />
                    </p>
                </TabsContent>
                <TabsContent value="plain" className="flex gap-2.5 bg-gold-soft p-3">
                    <Lightbulb className="mt-0.5 size-5 shrink-0 text-gold-foreground" aria-hidden="true" />
                    <p className="text-[15px]">
                        <Rich text={words.plain} />
                    </p>
                </TabsContent>
            </Tabs>
        </Card>
    );

    const devices = lesson.points && (
        <Section title={t("points.title")} hint={t("points.hint")}>
            <div className="px-3 py-1.5">
                <DeviceState points={lesson.points} steps={lesson.steps} current={current} words={words} />
            </div>
        </Section>
    );

    return (
        // The full width of the screen: the protocol list and the right-hand column grow with it, within bounds; the
        // middle takes the rest. Narrow gaps between the panels.
        <div className="grid gap-2 px-2 py-2 sm:px-3 lg:grid-cols-[clamp(13rem,14vw,17rem)_minmax(0,1fr)] xl:grid-cols-[clamp(13rem,14vw,17rem)_minmax(0,1fr)_clamp(20rem,22vw,28rem)]">
            <aside className="hidden lg:block">
                <div className="sticky top-16 max-h-[calc(100vh-4.5rem)] overflow-y-auto pe-1 pb-4">
                    <ProtocolNav current={meta.id} />
                </div>
            </aside>

            <main id="main" className="min-w-0 space-y-2">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Sheet open={navOpen} onOpenChange={setNavOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 lg:hidden">
                                <ListTree />
                                {t("nav.all")}
                            </Button>
                        </SheetTrigger>
                        <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-80 overflow-y-auto p-4">
                            <SheetHeader className="p-0">
                                <SheetTitle>{t("nav.protocols")}</SheetTitle>
                                <SheetDescription className="sr-only">{t("nav.all")}</SheetDescription>
                            </SheetHeader>
                            <ProtocolNav current={meta.id} onPick={() => setNavOpen(false)} />
                        </SheetContent>
                    </Sheet>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{meta.name}</h1>
                    <span
                        style={groupVars(meta.group)}
                        className="inline-flex items-center gap-2 rounded-sm bg-[color-mix(in_oklab,var(--g)_12%,transparent)] py-1 ps-1 pe-3 text-xs font-semibold tracking-wider text-[var(--g)] uppercase"
                    >
                        <GroupIcon group={meta.group} className="size-6" />
                        {t(`group.${meta.group}` as MessageKey)}
                    </span>
                </header>

                <Card className="gap-0 overflow-hidden py-0" data-testid="stage">
                    <Tabs defaultValue="site" className="gap-0">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                            <TabsList>
                                <TabsTrigger value="site">{t("view.site")}</TabsTrigger>
                                <TabsTrigger value="sequence">{t("view.sequence")}</TabsTrigger>
                                {lesson.singleLine && <TabsTrigger value="singleLine">{t("view.singleLine")}</TabsTrigger>}
                            </TabsList>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground max-lg:hidden">{t("player.keys")}</span>
                                <StepControls current={current} last={last} playing={playing} onGo={(index) => (setPlaying(false), go(index))} onPlay={togglePlay} />
                            </div>
                        </div>
                        <div className="border-b px-3 py-2">
                            <StepStrip steps={lesson.steps} current={current} onGo={(index) => (setPlaying(false), go(index))} words={words} />
                        </div>
                        <div className="border-b px-3 py-2.5">
                            <StepCaption steps={lesson.steps} current={current} wire={wire} words={words} />
                        </div>
                        <TabsContent value="site" className="bg-[var(--viz-ground)]">
                            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t("view.site")}>
                                <div className="min-w-[520px] px-2 pt-2">
                                    <SiteScene scene={lesson.scene} frame={selected} words={words} />
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="sequence" data-scroll="" className="max-h-[32rem] overflow-y-auto bg-[var(--viz-ground)]">
                            <SequenceDiagram actors={lesson.actors} frames={shownFrames} selected={selected?.id} onSelect={setChosen} words={words} />
                        </TabsContent>
                        {lesson.singleLine && (
                            <TabsContent value="singleLine" className="bg-[var(--viz-ground)] p-2">
                                <SingleLine diagram={lesson.singleLine} steps={lesson.steps} current={current} words={words} />
                            </TabsContent>
                        )}
                    </Tabs>
                </Card>

                {!wide && intro}
                <div className="xl:hidden">{devices}</div>

                <Section title={t("frames.title")} hint={t("frames.hint")}>
                    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t("frames.title")}>
                        <FrameList frames={shownFrames} selected={selected?.id} onSelect={setChosen} words={words} />
                    </div>
                </Section>

                {selected && (
                    <Section
                        title={selected.fields?.length && selected.size !== 0 ? `${t("bytes.title")} · ${selected.name}` : selected.name}
                        hint={selected.fields?.length && selected.size !== 0 ? t("bytes.hint") : undefined}
                        testId="frame"
                        action={frameSize(selected) ? <span className="font-mono text-xs text-muted-foreground">{t("frames.bytes", { count: frameSize(selected) })}</span> : undefined}
                    >
                        <div className="p-3">
                            <ByteInspector frame={selected} words={words} />
                        </div>
                    </Section>
                )}

                {lesson.timing && (
                    <Section title={words.timing("title")}>
                        <div className="space-y-2 p-3">
                            <TimingChart timing={lesson.timing} words={words} />
                            <p className="text-sm text-muted-foreground">
                                <Rich text={words.timing("note")} />
                            </p>
                        </div>
                    </Section>
                )}

                {lesson.anatomy && (
                    <Section title={t("anatomy.title")} hint={t("anatomy.hint")}>
                        <div className="space-y-4 p-3">
                            {lesson.anatomy.map((anatomy) => (
                                <NameAnatomy key={anatomy.id} anatomy={anatomy} words={words} />
                            ))}
                        </div>
                    </Section>
                )}

                {lesson.playground && (
                    <Section title={t("playground.title")} hint={t("playground.hint")}>
                        <div className="space-y-6 p-3">
                            {lesson.playground.map((item, i) =>
                                item.kind === "encoder" ? (
                                    <Encoder key={i} type={item.type} order={item.order} value={item.value} intro={words.playground(item.intro ?? "encoder")} />
                                ) : item.kind === "pwm" ? (
                                    <PilotDuty key={i} duty={item.duty} intro={words.playground(item.intro ?? "pwm")} />
                                ) : item.kind === "scl" ? (
                                    <SclExplorer key={i} sample={item.sample} file={item.file} intro={words.playground(item.intro ?? "scl")} />
                                ) : (
                                    <SampleFile key={i} name={item.sample} file={item.file} notes={item.notes} intro={words.playground(item.intro ?? "file")} noteText={words.playground} />
                                ),
                            )}
                        </div>
                    </Section>
                )}

                <div className="space-y-2 xl:hidden">
                    {facts}
                    <Tips words={words} />
                    <Related ids={lesson.related ?? []} />
                </div>
            </main>

            <aside className="hidden space-y-2 xl:block">
                {wide && intro}
                {facts}
                {devices}
                <Tips words={words} />
                <Related ids={lesson.related ?? []} />
            </aside>
        </div>
    );
}

function Facts({ meta, words, keys }: { meta: Meta; words: Words; keys: readonly string[] }) {
    const { t } = useI18n();
    return (
        <Card className="gap-0 py-0">
            <CardContent className="p-3">
                <dl className="grid grid-cols-[minmax(6rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                    {keys.map((key) => {
                        const value = words.fact(key as never);
                        return value ? (
                            <div key={key} className="contents">
                                <dt className="text-muted-foreground">{t(`fact.${key}` as MessageKey)}</dt>
                                <dd>{value}</dd>
                            </div>
                        ) : null;
                    })}
                    <dt className="text-muted-foreground">{t("fact.wire")}</dt>
                    <dd dir="ltr" className="text-left font-mono text-[13px] rtl:text-right">
                        {meta.wire}
                    </dd>
                </dl>
            </CardContent>
        </Card>
    );
}

function Tips({ words }: { words: Words }) {
    const { t } = useI18n();
    if (!words.tips.length) return null;
    return (
        <Card className="gap-0 py-0">
            <CardHeader className="px-3 pt-3 pb-1.5">
                <h2 className="text-base leading-none font-semibold">{t("tips.title")}</h2>
            </CardHeader>
            <CardContent className="px-3 pb-3">
                <ul className="list-disc space-y-1.5 ps-5 text-sm">
                    {words.tips.map((tip) => (
                        <li key={tip}>
                            <Rich text={tip} />
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

function Related({ ids }: { ids: readonly string[] }) {
    const { t } = useI18n();
    const metas = ids.flatMap((id) => metaOf(id) ?? []);
    if (!metas.length) return null;
    return (
        <Card className="gap-0 py-0">
            <CardHeader className="px-3 pt-3 pb-1.5">
                <h2 className="text-base leading-none font-semibold">{t("related.title")}</h2>
            </CardHeader>
            <CardContent className="px-3 pb-3">
                <ul className="space-y-1.5 text-sm">
                    {metas.map((meta) => (
                        <li key={meta.id}>
                            <Link to={`/p/${meta.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                                {meta.name}
                            </Link>
                            <span className="block text-muted-foreground">{t(`lesson.${meta.id}.summary` as MessageKey)}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

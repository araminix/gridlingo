import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/i18n/i18n";
import { cn } from "@/lib/utils";
import { decode, encode, formatFloat, ORDERS, parseHex, toHex, TYPES, widthOf, type ByteOrder, type NumberType } from "./encode";

/** A value and its bytes, both ways, and what the same bytes mean when read in another byte order. */
export function Encoder({ type: startType, order: startOrder, value: startValue, intro }: { type: NumberType; order: ByteOrder; value: number; intro: string }) {
    const { t } = useI18n();
    const id = useId();
    const [type, setType] = useState(startType);
    const [order, setOrder] = useState(startOrder);
    const [valueText, setValueText] = useState(formatFloat(startValue));
    const [hexText, setHexText] = useState(() => toHex(encode(startValue, startType, startOrder) ?? []));

    const bytes = parseHex(hexText);
    const fits = bytes?.length === widthOf(type);
    const orders = widthOf(type) === 2 ? (["ABCD", "DCBA"] as const) : ORDERS;

    const fromValue = (text: string, nextType = type, nextOrder = order) => {
        setValueText(text);
        const encoded = encode(Number(text.replace(",", ".")), nextType, nextOrder);
        if (encoded) setHexText(toHex(encoded));
    };
    const fromHex = (text: string) => {
        setHexText(text);
        const parsed = parseHex(text);
        const value = parsed ? decode(parsed, type, order) : null;
        if (value !== null) setValueText(type === "float32" ? formatFloat(value) : String(value));
    };

    const valueInvalid = encode(Number(valueText.replace(",", ".")), type, order) === null;
    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{intro}</p>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label htmlFor={`${id}v`} className="text-xs font-semibold">
                        {t("encoder.value")}
                    </label>
                    <Input id={`${id}v`} dir="ltr" inputMode="decimal" value={valueText} aria-invalid={valueInvalid} onChange={(event) => fromValue(event.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor={`${id}h`} className="text-xs font-semibold">
                        {t("encoder.bytes")}
                    </label>
                    <Input id={`${id}h`} dir="ltr" value={hexText} aria-invalid={!fits} onChange={(event) => fromHex(event.target.value)} className="font-mono uppercase" />
                </div>
                <div className="space-y-1.5">
                    <span id={`${id}t`} className="text-xs font-semibold">
                        {t("encoder.type")}
                    </span>
                    <Select
                        value={type}
                        onValueChange={(next) => {
                            const nextType = next as NumberType;
                            // A 2-byte value only has two orders: as sent, or swapped
                            const nextOrder = widthOf(nextType) === 2 ? (order === "CDAB" ? "ABCD" : order === "BADC" ? "DCBA" : order) : order;
                            setType(nextType);
                            setOrder(nextOrder);
                            fromValue(valueText, nextType, nextOrder);
                        }}
                    >
                        <SelectTrigger aria-labelledby={`${id}t`} className="w-full font-mono">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TYPES.map((item) => (
                                <SelectItem key={item} value={item} className="font-mono">
                                    {item}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <span id={`${id}o`} className="text-xs font-semibold">
                        {t("encoder.order")}
                    </span>
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        value={order}
                        onValueChange={(next) => {
                            if (!next) return;
                            setOrder(next as ByteOrder);
                            fromValue(valueText, type, next as ByteOrder);
                        }}
                        aria-labelledby={`${id}o`}
                        dir="ltr"
                        className="w-full"
                    >
                        {orders.map((item) => (
                            <ToggleGroupItem key={item} value={item} className="flex-1 font-mono">
                                {widthOf(type) === 2 ? item.slice(0, 2) : item}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>
            </div>
            {fits && (
                <div className="space-y-1.5">
                    <p className="text-xs font-semibold">{t("encoder.misread")}</p>
                    <ul dir="ltr" className="grid gap-2 sm:grid-cols-2">
                        {orders.map((item) => {
                            const value = decode(bytes!, type, item);
                            return (
                                <li key={item} className={cn("flex justify-between gap-3 rounded-md border px-3 py-2 font-mono text-sm", item === order && "border-primary bg-accent")}>
                                    <span className="text-muted-foreground">{widthOf(type) === 2 ? item.slice(0, 2) : item}</span>
                                    <span className="truncate font-semibold">{value === null ? "–" : type === "float32" ? formatFloat(value) : value}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}

/** The mark: an isometric box (a device) with a signal running across it. */
export function Logo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
            <path d="M17 3 L30 10.5 L30 23.5 L17 31 L4 23.5 L4 10.5 Z" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M4 10.5 L17 18 L30 10.5 M17 18 L17 31" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M7.5 16.5 C9.5 13.5 11.5 19.5 13.5 16.5" fill="none" stroke="var(--viz-token)" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
    );
}

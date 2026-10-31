import { useEffect, useId, useRef, useState } from 'react'

export function HelpHint({ text }: { text: string }) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLSpanElement>(null)
    const tooltipId = useId()

    useEffect(() => {
        if (!open) return

        const onPointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    return (
        <span
            className="pr-help-hint"
            ref={containerRef}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => {
                if (!containerRef.current?.contains(document.activeElement)) {
                    setOpen(false)
                }
            }}
        >
            <button
                type="button"
                className="pr-help-hint-trigger"
                aria-label={text}
                aria-describedby={open ? tooltipId : undefined}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onClick={() => setOpen(true)}
            >
                <span aria-hidden="true">?</span>
            </button>
            {open && (
                <span
                    className="pr-help-hint-tip"
                    id={tooltipId}
                    role="tooltip"
                >
                    {text}
                </span>
            )}
        </span>
    )
}

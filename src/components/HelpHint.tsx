import {
    type ReactNode,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import { createPortal } from 'react-dom'

export function HelpHint({
    text,
    children,
}: {
    text: string
    children: ReactNode
}) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLSpanElement>(null)
    const pointerFocusRef = useRef(false)
    const tooltipId = useId()
    const tooltipRef = useRef<HTMLSpanElement>(null)
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(
        null,
    )
    const [position, setPosition] = useState({ left: 0, top: 0 })

    useLayoutEffect(() => {
        if (!open || !tooltipRef.current || !containerRef.current) return
        const bounds = tooltipRef.current.getBoundingClientRect()
        const trigger = containerRef.current.getBoundingClientRect()
        const x = pointer?.x ?? trigger.left
        const y = pointer?.y ?? trigger.bottom
        setPosition({
            left: Math.max(
                8,
                Math.min(x + 12, window.innerWidth - bounds.width - 8),
            ),
            top: Math.max(
                8,
                y + 16 + bounds.height <= window.innerHeight - 8
                    ? y + 16
                    : y - bounds.height - 12,
            ),
        })
    }, [open, pointer, text])

    useEffect(() => {
        if (!open) return

        const onOutsidePointer = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('pointermove', onOutsidePointer)
        document.addEventListener('pointerdown', onOutsidePointer)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('pointermove', onOutsidePointer)
            document.removeEventListener('pointerdown', onOutsidePointer)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    return (
        <span
            className="pr-help-hint"
            ref={containerRef}
            aria-describedby={open ? tooltipId : undefined}
            onPointerDownCapture={() => {
                pointerFocusRef.current = true
                setOpen(false)
            }}
            onFocus={() => {
                if (pointerFocusRef.current) return
                setPointer(null)
                setOpen(true)
            }}
            onBlur={() => {
                pointerFocusRef.current = false
                setOpen(false)
            }}
            onChange={() => setOpen(false)}
            onMouseEnter={(event) => {
                setPointer({ x: event.clientX, y: event.clientY })
                setOpen(true)
            }}
            onMouseMove={(event) =>
                setPointer({ x: event.clientX, y: event.clientY })
            }
            onMouseLeave={() => setOpen(false)}
        >
            {children}
            {open &&
                createPortal(
                    <span
                        className="pr-help-hint-tip"
                        ref={tooltipRef}
                        style={position}
                        id={tooltipId}
                        role="tooltip"
                    >
                        {text}
                    </span>,
                    document.body,
                )}
        </span>
    )
}

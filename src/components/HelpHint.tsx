import { type ReactNode, useId } from 'react'
import { createPortal } from 'react-dom'
import { Tooltip } from 'react-tooltip'

export function HelpHint({
    text,
    children,
}: {
    text: string
    children: ReactNode
}) {
    const id = useId()

    return (
        <>
            <span className="pr-help-hint" data-help-hint={id}>
                {children}
            </span>
            {createPortal(
                <Tooltip
                    id={id}
                    anchorSelect={`[data-help-hint="${id}"], [data-help-hint="${id}"] select, [data-help-hint="${id}"] button`}
                    content={text}
                    className="pr-help-hint-tip"
                    place="bottom-start"
                    positionStrategy="fixed"
                    float
                    noArrow
                    offset={12}
                    opacity={1}
                    openEvents={{ mouseover: true, focus: true }}
                    closeEvents={{
                        mouseout: true,
                        blur: true,
                        mousedown: true,
                        click: true,
                    }}
                    globalCloseEvents={{
                        escape: true,
                        scroll: true,
                        resize: true,
                        clickOutsideAnchor: true,
                    }}
                />,
                document.body,
            )}
        </>
    )
}

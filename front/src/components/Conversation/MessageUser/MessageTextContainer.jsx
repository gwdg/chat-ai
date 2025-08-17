import { useRef, useEffect } from "react";

// Constants
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 56;

export default function MessageTextContainer({ message }) {
    const textareaRef = useRef(null);

    // Function to adjust textarea height
    const adjustHeight = () => {
        if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_HEIGHT}px`;

        const scrollHeight = textareaRef.current.scrollHeight;
        const newHeight = Math.min(scrollHeight, MAX_HEIGHT);

        textareaRef.current.style.height = `${Math.max(newHeight, MIN_HEIGHT)}px`;
        }
    };

    // UseEffect to adjust height on content change
    useEffect(() => {
        requestAnimationFrame(() => adjustHeight());
    }, [message.content[0].data, adjustHeight]);

    return (
        <pre
            ref={textareaRef}
            className="font-sans flex-grow min-w-0 text-sm"
            style={{
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
            }}
        >
            {message.content[0].data}
        </pre>
    );
}
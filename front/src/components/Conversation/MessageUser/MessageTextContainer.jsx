import { useRef, useEffect } from "react";

// Constants
const MAX_HEIGHT = 200;
const MIN_HEIGHT = 26;

export default function MessageTextContainer({ message }) {
    return (
        <pre
            className="font-sans flex-grow min-w-0 text-sm"
            style={{
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
            }}
        >
            {message.content[0]?.text}
        </pre>
    );
}
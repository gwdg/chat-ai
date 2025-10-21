export default function MetaBox({ meta }) {
    // Function to truncate the model name
    const truncateModel = (text, length) => {
        if (!text) return "";
        return text.length > length ? text.slice(0, length) + "..." : text;
    };
    let parts = [];
    if (meta?.model) {
        // Truncate very long model names — adjust as needed
        parts.push(truncateModel(meta.model, 30));
    }
    if (meta?.usage) {
        const promptTokens = meta.usage?.prompt_tokens ?? "N/A";
        const completionTokens = meta.usage?.completion_tokens ?? "N/A";
        parts.push(`${promptTokens} + ${completionTokens} tokens`);
    }
    // Combine with non-breaking spaces around dot
    const displayText = parts.join(" \u00A0•\u00A0 ");

    return (
        <div className="
            items-center justify-end min-w-0 flex-shrink w-auto
            max-w-[200px] sm:max-w-[400px] md:max-w-[800px]
            opacity-0 sm:opacity-40 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-300">
            <p
                className="
                    text-xs text-gray-500 text-right dark:text-gray-400
                    truncate
                "
            >
                {displayText}
            </p>
        </div>
    );
}
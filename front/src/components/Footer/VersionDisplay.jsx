import packageJson from "../../../package.json";

export default function VersionDisplay() {
    return (
    <p className="flex items-center gap-2">
    <a
        href="https://github.com/gwdg/chat-ai"
        target="_blank"
        rel="noopener noreferrer"
        className="text-info hover:underline inline-flex items-center"
    >
        {packageJson.displayName}
        {" v"}
        {packageJson.version}
    </a>{" "}
    </p>
    );
}
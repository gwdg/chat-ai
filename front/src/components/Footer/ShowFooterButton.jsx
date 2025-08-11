import arrow_down_purple from "../../assets/icons/arrow_down_purple.svg";

export default function ShowFooterButton({toggleFooter}) {
    return (
    <div className="flex justify-center items-center h-8 py-2 touch-manipulation">
      <div
        onClick={toggleFooter}
        className="cursor-pointer p-2 rounded-lg transition-colors touch-manipulation"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <img
          className="h-4 w-12 rotate-180"
          src={arrow_down_purple}
          alt="Show footer"
        />
      </div>
    </div>
    );
}
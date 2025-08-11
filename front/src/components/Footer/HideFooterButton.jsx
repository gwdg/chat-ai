import arrow_down_purple from "../../assets/icons/arrow_down_purple.svg";

export default function HideFooterButton({scrollToTop, toggleFooter}) {
    return (
    <div className="bg-white dark:bg-black h-[20px] pb-4 ">
      <img
        onClick={() => {
          scrollToTop();
          toggleFooter();
        }}
        className="cursor-pointer h-[15px] w-[55px]"
        src={arrow_down_purple}
        alt="Toggle footer"
      />
    </div>
    );
}
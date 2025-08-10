import arrow_down from "../../assets/footer_arrow.svg";

export default function HideFooterButton({scrollToTop, toggleFooter}) {
    return (
    <div className="bg-white dark:bg-black h-[20px] pb-4 ">
      <img
        onClick={() => {
          scrollToTop();
          toggleFooter();
        }}
        className="cursor-pointer h-[15px] w-[55px]"
        src={arrow_down}
        alt="Toggle footer"
      />
    </div>
    );
}
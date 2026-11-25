import BrandLogo from "../Others/BrandLogo";

export default function EmptyConversation() {

  return (
    <div className="flex flex-col items-center justify-center w-full p-4 select-none">
      <BrandLogo
        className="max-w-[160px] sm:max-w-[200px] md:max-w-[240px] w-full object-contain filter opacity-80 grayscale drop-shadow-lg"
      />
    </div>
  );
}

import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import LogoSmall from '../../config/branding/chatai/logo-small.ico'
import ImageAiLogo from '../../assets/logos/image-ai.svg'
import VoiceAiLogo from '../../assets/logos/voice-ai.svg'
import BrandLogo from '../Others/BrandLogo'
import { useBrand } from '../../config/BrandProvider'
import { isArcanasEnabled } from '../../utils/modules'

const items = [
  {
    name: '',
    description: 'Generate images with AI',
    href: 'https://image-ai.academiccloud.de/',
    icon: (
      <img className="h-10 w-auto object-contain mx-auto" src={ImageAiLogo} alt="Image AI Logo" />
    ),
  },
  {
    name: '',
    description: 'Speech-to-Text conversion',
    href: 'https://voice-ai.academiccloud.de/',
    icon: (
      <img className="h-8 w-auto object-contain mx-auto" src={VoiceAiLogo} alt="Voice AI Logo" />
    ),
  },
  {
    name: 'RAG-Manager',
    description: 'Vector database management',
    href: 'https://chat-ai.academiccloud.de/arcanas/',
    icon: (
      <img className="h-9 w-auto object-contain mx-auto" src={LogoSmall} alt="RAG Manager Logo" />
    ),
  },
]

export default function AiServicesMenu() {
  const { brand } = useBrand()
  const headerVariant = brand.logo?.headerVariant ?? "full"

  // A sub-brand may present its own identity without the GWDG service family.
  if (brand.services === false) {
    return (
      <div className="m-1 p-2 inline-flex items-center" aria-label={brand.name}>
        <BrandLogo
          variant={headerVariant}
          className="h-10 w-auto max-w-[180px] object-contain"
          alt={brand.logo?.alt || brand.name}
        />
      </div>
    )
  }

  return (
    <Popover className="relative ">
      <PopoverButton
        aria-label="Open AI services menu"
        className="focus:outline-none m-1 p-2 inline-flex items-center rounded-xl hover:bg-base-200 cursor-pointer transition-colors duration-150 "
      >
        <BrandLogo
          variant={headerVariant}
          className="h-10 w-auto max-w-[180px] object-contain"
          alt={brand.logo?.alt || brand.name}
        />
      </PopoverButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-150"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <PopoverPanel
          anchor="bottom"
          className="relative !overflow-visible ml-1 z-50 mt-2 rounded-2xl border border-base-300 bg-base-100 shadow-xl dark:shadow-dark p-3 "
        >
          <div
            className="absolute -top-2 left-10 md:right-6.5 w-4 h-4 z-10 
 bg-base-100 
 border-l border-t border-base-300 
                          transform rotate-45"
          ></div>
          <nav className="flex flex-col space-y-2">
            {items
              .filter((item) => item.name !== 'RAG-Manager' || isArcanasEnabled())
              .map((item) => (
              <a
                target='_blank'
                key={item.description}
                href={item.href}
                className="group flex flex-col items-center p-2 rounded-xl
 hover:bg-base-200 focus:bg-base-200
                           transition-all duration-150 outline-none border border-transparent hover:border-base-300"
              >
                <div className="flex
                 items-center justify-center rounded-lg">
                  {(item.name && item.name !== "") && (
                    <div className="text-lg font-semibold text-base-content/70 mb-1">
                      {item.name}
                    </div>
                  )}
                  {item.icon}
                </div>

                <div className="text-center text-xs text-base-content/70">
                  {item.description}
                </div>
              </a>
            ))}
          </nav>
        </PopoverPanel>
      </Transition>
    </Popover>
  )
}
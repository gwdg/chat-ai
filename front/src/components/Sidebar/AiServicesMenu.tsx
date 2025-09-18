import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import Logo from '../../assets/logos/chat_ai.svg'
import LogoSmall from '../../assets/logos/chat_ai_small.ico'
import ImageAiLogo from '../../assets/logos/image-ai.svg'
import VoiceAiLogo from '../../assets/logos/voice-ai.svg'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight } from '@fortawesome/free-solid-svg-icons'

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
  return (
    <Popover className="relative ">
      <PopoverButton
        aria-label="Open AI services menu"
        className="focus:outline-none m-1 p-2 inline-flex items-center rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-150 "
      >
        <img className="h-10 w-auto object-contain" src={Logo} alt="Chat AI Logo" />
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
          className="relative !overflow-visible ml-1 z-50 mt-2 rounded-2xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-bg_secondary_dark shadow-xl dark:shadow-dark p-3 "
        >
          <div
            className="absolute -top-2 left-10 md:right-6.5 w-4 h-4 z-10 
                          bg-white dark:bg-bg_secondary_dark 
                          border-l border-t border-gray-200 dark:border-gray-600 
                          transform rotate-45"
          ></div>
          <nav className="flex flex-col space-y-2">
            {items.map((item) => (
              <a
                target='_blank'
                key={item.description}
                href={item.href}
                className="group flex flex-col items-center p-2 rounded-xl
                           hover:bg-slate-50 dark:hover:bg-[#25262b] focus:bg-slate-50 dark:focus:bg-[#25262b]
                           transition-all duration-150 outline-none border border-transparent hover:border-slate-200 dark:hover:border-gray-700"
              >
                <div className="flex
                 items-center justify-center rounded-lg">
                  {(item.name && item.name !== "") && (
                    <div className="text-lg font-semibold text-[#ababab] dark:text-slate-100 mb-1">
                      {item.name}
                    </div>
                  )}
                  {item.icon}
                </div>

                <div className="text-center text-xs text-slate-600 dark:text-gray-300">
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
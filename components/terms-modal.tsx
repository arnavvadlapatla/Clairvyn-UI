"use client"

import { useState } from "react"

export default function TermsModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Inline link (styled like the other quicklinks so alignment doesn't shift) */}
      <button
        onClick={() => {
          console.log('Terms button clicked!')
          setOpen(true)
        }}
        className="text-gray-600 hover:text-teal-600 transition-colors font-medium focus:outline-none"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Terms of Service
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden">
            {/* header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Terms of Service</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Clairvyn Privacy and Data Use Consent Notice</p>
              </div>
              <div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close terms"
                  className="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* body: full document, scrollable */}
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="prose prose-sm dark:prose-invert text-sm leading-relaxed space-y-4">
                <p>
                  At Clairvyn Private Limited ("Clairvyn", "we", "our", or "us"), your privacy is of paramount
                  importance to us. This notice explains in clear and transparent terms how we collect, use,
                  store, and share the information you provide when you interact with our platform, tools, or
                  services, including the ways in which we may use such information for research, development,
                  and scientific purposes. By continuing to use our services and expressly consenting where
                  prompted, you agree to the terms of this policy.
                </p>

                <p>
                  When you engage with Clairvyn's services, you may be asked to submit or provide various types
                  of information including, but not limited to, written responses, audio recordings, uploaded
                  content, and other interactions generated during your use of our platform. These responses and
                  interactions may include your thoughts, preferences, opinions, or any other personal inputs
                  you choose to share with us. In addition to this direct input, certain technical and usage
                  data may also be automatically collected, such as your device type, browser details, IP
                  address, time of access, location data (based on your IP or device settings), and system logs.
                  This data helps us improve the stability, performance, and usability of our services.
                </p>

                <p>
                  We may record and retain your responses and related data for the purpose of enhancing the
                  quality, reliability, and scope of our products and services. Furthermore, we may analyze and
                  use such responses internally for the purposes of academic study, scientific research, machine
                  learning, product optimization, or publication in anonymized form. The information collected
                  may be used to develop new technologies, refine our algorithms, or assess how users engage
                  with specific features or queries. This helps us in advancing innovation, driving user-centric
                  design, and contributing to the broader body of knowledge in emerging fields such as
                  artificial intelligence and human–computer interaction.
                </p>

                <p>
                  We assure you that your personal data and responses will not be sold to third parties. However,
                  we may engage with carefully selected service providers, research institutions, or affiliates
                  for the limited purpose of facilitating our services, processing information securely, or
                  conducting internal research. Any such sharing shall be strictly governed by confidentiality
                  obligations and in accordance with applicable laws. In circumstances where we are required by
                  law, legal process, or governmental authorities to disclose specific information, we will
                  comply accordingly.
                </p>

                <p>
                  Your participation is entirely voluntary, and your consent forms the legal basis on which we
                  process your information for the purposes described above. By agreeing to this privacy and
                  data use notice, you explicitly grant Clairvyn Private Limited the right to collect, store,
                  analyze, and utilize your responses and related data, including but not limited to text,
                  voice, files, or media, for internal and external research or development purposes. This
                  consent remains valid unless and until you decide to withdraw it. You may withdraw your
                  consent at any time by contacting us at{" "}
                  <a href="mailto:hello@clairvyn.com" className="text-teal-600 underline">
                    hello@clairvyn.com
                  </a>
                  . Upon receiving such a request, we will take appropriate steps to discontinue the use of your
                  personal data for future research or product development, subject to our legal or regulatory
                  obligations. You also have the right to request access to the personal data we hold about you,
                  to correct any inaccuracies, or to request deletion of your data, unless we are required to
                  retain certain information under law or for legitimate business purposes.
                </p>

                <p>
                  We employ industry-standard security measures to safeguard your data and ensure its
                  confidentiality, integrity, and availability. Our data storage systems, access controls,
                  encryption standards, and employee protocols are designed to protect your information from
                  unauthorized access or misuse.
                </p>

                <p>
                  This notice may be updated from time to time to reflect changes in our practices, legal
                  requirements, or technology. You will be notified of any significant updates through our
                  website or email, and your continued use of our services following such updates shall
                  constitute acceptance of the revised terms. If you have any questions, concerns, or wish to
                  exercise your data protection rights, you may contact us at{" "}
                  <a href="mailto:hello@clairvyn.com" className="text-teal-600 underline">
                    hello@clairvyn.com
                  </a>{" "}
                  or write to us at our registered address: Clairvyn Private Limited, [No. 136/1, No. 8/9,
                  Parvallal Street, Murugappa Nagar, Ennore RS, Tiruvallur, Tamil Nadu, - 600 057], India.
                </p>

                <p>
                  By proceeding, you confirm that you have read, understood, and voluntarily consent to the
                  collection and use of your responses and data by Clairvyn Private Limited as outlined in this
                  Privacy and Consent Notice.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  )
}

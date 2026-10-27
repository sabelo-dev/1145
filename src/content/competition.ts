/**
 * XIXLV DROP competition rules (South Africa, Consumer Protection Act s36).
 *
 * DRAFT: set `approved` to true only after legal review. Until then the
 * homepage links to the general terms and /competitions/xixlv-drop/terms
 * redirects there, so nothing unreviewed is presented as binding.
 * Items in `toConfirm` must be settled before approval.
 */
export const competitionTerms = {
  approved: false,
  slug: "xixlv-drop",
  title: "XIXLV DROP competition rules",
  prize: "R15,000 in 1145 shopping vouchers: 10 winners of R1,500 each",
  opens: "2026-10-27",
  closes: "2027-02-27T23:59:59+02:00",
  drawDate: "2027-03-06",
  /** Fill in, then add a "Promoter" section, before approving. */
  promoter: { name: "", registrationNumber: "", address: "" },
  toConfirm: [
    "Promoter's registered legal entity name, registration number and address",
    "Name of the independent person who supervises the draw",
  ],
  sections: [
    {
      heading: "Who can enter",
      body: [
        "The competition is open to South African residents aged 18 or older with a valid 1145 account.",
        "Employees, directors and agents of the promoter and their immediate families, and the promoter's suppliers involved in the competition, may not enter.",
      ],
    },
    {
      heading: "How to enter",
      body: [
        "Download the 1145 app, register an account and share your personal invite link during the competition period.",
        "Entry is free. Standard data costs may apply. One entry per person; duplicate or automated accounts are disqualified.",
      ],
    },
    {
      heading: "Competition period",
      body: ["The competition opens on 27 October 2026 and closes at 23:59 (SAST) on 27 February 2027. Late entries are not accepted."],
    },
    {
      heading: "Prizes",
      body: [
        "The total prize pool is R15,000 in 1145 shopping vouchers: 10 winners each receive one R1,500 voucher.",
        "Vouchers can be used on the 1145 marketplace and are valid for 6 months from the date they are issued. Any unused balance expires with the voucher.",
        "Prizes are not transferable and cannot be exchanged for cash.",
      ],
    },
    {
      heading: "Winner selection and notification",
      body: [
        "Ten winners are drawn at random by electronic draw from all valid entries on 6 March 2027, under the supervision of an independent person.",
        "Winners are contacted using the details on their 1145 account and must respond within 7 days, or another winner may be drawn.",
        "Winners may be asked to provide proof of identity and age before receiving a prize.",
      ],
    },
    {
      heading: "Privacy",
      body: ["Personal information is used only to run the competition and deliver prizes, in line with the 1145 Privacy Policy and POPIA."],
    },
    {
      heading: "General",
      body: [
        "The promoter may amend or end the competition if circumstances beyond its control require it, and will publish any change on this page.",
        "The promoter's decision on the competition is final. These rules are governed by the laws of South Africa.",
      ],
    },
  ],
};

export const competitionTermsPath = `/competitions/${competitionTerms.slug}/terms`;

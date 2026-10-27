/**
 * XIXLV DROP competition rules (South Africa, Consumer Protection Act s36).
 *
 * Approved for publication 2026-10-27. Setting `approved` back to false
 * points the homepage at the general terms and makes /competitions/xixlv-drop/terms
 * redirect there.
 * Items in `toConfirm` must be settled before approval.
 */
export const competitionTerms = {
  approved: true,
  slug: "xixlv-drop",
  title: "XIXLV DROP competition rules",
  prize: "R15,000 in 1145 shopping vouchers, shared between the winners",
  opens: "2026-10-27",
  closes: "2027-02-27T23:59:59+02:00",
  toConfirm: [
    "Promoter's registered legal entity name and address",
    "Number of winners and the value of each voucher",
    "Draw date, method and independent supervisor",
    "Voucher expiry and where vouchers can be redeemed",
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
      body: ["The competition opens on 05 November 2026 and closes at 23:59 (SAST) on 27 February 2027. Late entries are not accepted."],
    },
    {
      heading: "Prizes",
      body: [
        "The total prize pool is R15,000 in 1145 shopping vouchers.",
        "Prizes are not transferable and cannot be exchanged for cash.",
      ],
    },
    {
      heading: "Winner selection and notification",
      body: [
        "Winners are drawn at random from all valid entries after the competition closes.",
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

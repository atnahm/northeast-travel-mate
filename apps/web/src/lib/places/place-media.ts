import type { CitizenType } from "@ne-mate/shared";

export const STATE_FULL_NAMES: Record<string, string> = {
  AS: "Assam",
  ML: "Meghalaya",
  AR: "Arunachal Pradesh",
  NL: "Nagaland",
  MN: "Manipur",
  MZ: "Mizoram",
  TR: "Tripura",
  SK: "Sikkim",
};

export interface EditorialPlaceMeta {
  imageUrl: string;
  imageCaption: string;
  elevationOrTransit: string;
  fieldNote: string;
}

/**
 * Curated regional photography (downloaded from verified Wikimedia Commons / Wikipedia landmark pages
 * into /places/<place_id>.jpg) and practical field logistics for North-East India destinations.
 */
export const PLACE_EDITORIAL_MEDIA: Record<string, EditorialPlaceMeta> = {
  place_as_kaziranga: {
    imageUrl: "/places/place_as_kaziranga.jpg",
    imageCaption: "Greater one-horned rhinoceros in Kaziranga National Park, Assam",
    elevationOrTransit: "4.5 hr drive from Guwahati via NH-715",
    fieldNote:
      "Central (Kohora) and Western (Bagori) ranges open November to April. Reserve morning jeep entry a day ahead at the Kohora range office.",
  },
  place_as_majuli: {
    imageUrl: "/places/place_as_majuli.jpg",
    imageCaption: "Brahmaputra river crossing to Majuli Island, Assam",
    elevationOrTransit: "Ferry from Nimati Ghat (Jorhat), 07:30 to 15:30",
    fieldNote:
      "Board the Ro-Pax or passenger boat at Nimati Ghat before 14:30. Rent a bicycle in Kamalabari to visit Samaguri mask-making satra.",
  },
  place_as_kamakhya: {
    imageUrl: "/places/place_as_kamakhya.jpg",
    imageCaption: "Kamakhya Temple atop Nilachal Hill, Guwahati",
    elevationOrTransit: "25 min cab from Guwahati or Kamakhya station",
    fieldNote:
      "Gates open at 05:30 and pause 13:00 to 14:30. Arrive before 06:30 to register for general darshan queues.",
  },
  place_as_manas: {
    imageUrl: "/places/place_as_manas.jpg",
    imageCaption: "Manas National Park & Biosphere Reserve, Assam",
    elevationOrTransit: "3.5 hr drive west of Guwahati via Barpeta Road",
    fieldNote:
      "Enter through Bansbari Gate between 06:30 and 16:00. Best combined with a Mathanguri river-border forest permit.",
  },
  place_ml_shillong: {
    imageUrl: "/places/place_ml_shillong.jpg",
    imageCaption: "East Khasi pine hills of Shillong, Meghalaya",
    elevationOrTransit: "1,525 m · 3 hr shared Sumo or cab from Guwahati",
    fieldNote:
      "Shared Sumos depart Paltan Bazar (Guwahati) all morning along NH-6. Walk Police Bazar and Laitumkhrah for traditional Khasi Jadoh kitchens.",
  },
  place_ml_cherrapunji: {
    imageUrl: "/places/place_ml_cherrapunji.jpg",
    imageCaption: "Nohkalikai Falls on the Sohra (Cherrapunji) escarpment, Meghalaya",
    elevationOrTransit: "1,480 m · 54 km south of Shillong",
    fieldNote:
      "Leave Shillong before 08:00 to reach Nohkalikai and Wei Sawdong before afternoon cloud cover moves across the plateau.",
  },
  place_ml_nongriat: {
    imageUrl: "/places/place_ml_nongriat.jpg",
    imageCaption: "Nongriat Double Decker Living Root Bridge, Meghalaya",
    elevationOrTransit: "3,500 stone steps · 1.5 hr descent from Tyrna",
    fieldNote:
      "Drive 45 minutes from Sohra to Tyrna trailhead. Carry cash for the village trail maintenance desk and start the climb back before 14:30.",
  },
  place_ml_dawki: {
    imageUrl: "/places/place_ml_dawki.jpg",
    imageCaption: "Country boats on the Umngot River at Dawki, Meghalaya",
    elevationOrTransit: "82 km south of Shillong via NH-206",
    fieldNote:
      "Water clarity is highest from November to February upstream at Shnongpdeng. Skip boating from June to September during monsoon runoff.",
  },
  place_ar_tawang: {
    imageUrl: "/places/place_ar_tawang.jpg",
    imageCaption: "Tawang Monastery (Galden Namgey Lhatse) at 3,048 m, Arunachal Pradesh",
    elevationOrTransit: "3,048 m · 2-day overland route via Dirang & Sela Tunnel",
    fieldNote:
      "Break the journey overnight in Dirang (1,500 m) to acclimatize. Keep two printed copies of your Arunachal ILP or PAP for the Bhalukpong and Sela checkposts.",
  },
  place_ar_ziro: {
    imageUrl: "/places/place_ar_ziro.jpg",
    imageCaption: "Ziro Valley & Apatani rice terraces, Arunachal Pradesh",
    elevationOrTransit: "1,500 m · Overnight train to Naharlagun, 3.5 hr Sumo",
    fieldNote:
      "Take the overnight Lachit Express to Naharlagun, then board the morning shared Tata Sumo to Hapoli and Old Ziro.",
  },
  place_ar_sela: {
    imageUrl: "/places/place_ar_sela.jpg",
    imageCaption: "High-altitude Sela Pass & Sela Lake, Arunachal Pradesh",
    elevationOrTransit: "4,170 m · Dirang to Tawang highway",
    fieldNote:
      "Cross before 14:30 for clear visibility. Use the Sela Tunnel bypass during heavy winter snow or black-ice advisories.",
  },
  place_ar_mechuka: {
    imageUrl: "/places/place_ar_mechuka.jpg",
    imageCaption: "Menchukha (Mechuka) valley along the Yargyap Chu river",
    elevationOrTransit: "1,829 m · 7 hr drive north from Aalo via Dibrugarh",
    fieldNote:
      "Pre-book a Memba family homestay in Mechuka town and confirm your Arunachal ILP covers Shi-Yomi district.",
  },
  place_nl_kohima: {
    imageUrl: "/places/place_nl_kohima.jpg",
    imageCaption: "Kohima War Cemetery terraces, Nagaland",
    elevationOrTransit: "1,444 m · 2.5 hr climb from Dimapur railhead",
    fieldNote:
      "Dimapur (DMV) is the primary rail and air gateway. Keep your Nagaland ILP ready at the Chümoukedima checkgate before the uphill climb.",
  },
  place_nl_dzukou: {
    imageUrl: "/places/place_nl_dzukou.jpg",
    imageCaption: "Rolling bamboo hills of Dzükou Valley, Nagaland",
    elevationOrTransit: "2,452 m · 4 hr trek from Viswema or Jakhama",
    fieldNote:
      "Register at the Southern Angami youth desk at Viswema before 08:30. Single-use plastic is prohibited inside the valley.",
  },
  place_nl_khonoma: {
    imageUrl: "/places/place_nl_khonoma.jpg",
    imageCaption: "Terraced alder fields of Khonoma village, Nagaland",
    elevationOrTransit: "20 km west of Kohima",
    fieldNote:
      "Community-conserved Angami village and nature tragopan sanctuary. Hire a village walking guide at the main gate.",
  },
  place_nl_mon: {
    imageUrl: "/places/place_nl_mon.jpg",
    imageCaption: "Konyak hills of Mon district and Longwa, Nagaland",
    elevationOrTransit: "5.5 hr drive from Jorhat / Sonari via Tizit",
    fieldNote:
      "Engage a local Konyak guide in Mon town before visiting Longwa village on the India–Myanmar ridge.",
  },
  place_mn_loktak: {
    imageUrl: "/places/place_mn_loktak.jpg",
    imageCaption: "Circular phumdis on Loktak Lake & Keibul Lamjao, Manipur",
    elevationOrTransit: "48 km south of Imphal at Moirang / Sendra",
    fieldNote:
      "Visit Keibul Lamjao viewpoint at dawn for Sangai deer sightings. Carry your Manipur ILP issued at Imphal airport or online.",
  },
  place_mn_ima_keithel: {
    imageUrl: "/places/place_mn_ima_keithel.jpg",
    imageCaption: "Ima Keithel (Mothers' Market) in central Imphal, Manipur",
    elevationOrTransit: "Central Imphal · 20 min from Imphal Airport",
    fieldNote:
      "Open 07:00 to 18:00 daily; pair with Kangla Fort across the road before 16:00.",
  },
  place_mz_aizawl: {
    imageUrl: "/places/place_mz_aizawl.jpg",
    imageCaption: "Hilltop neighbourhoods of Aizawl, Mizoram",
    elevationOrTransit: "1,132 m · 45 min drive from Sairang railhead or Lengpui Airport",
    fieldNote:
      "Obtain your Mizoram ILP online or at Lengpui/Vairengte/Sairang checkgate. Note that markets and taxis close on Sundays.",
  },
  place_mz_reiek: {
    imageUrl: "/places/place_mz_reiek.jpg",
    imageCaption: "Reiek Tlang ridge overlooking the Aizawl hills, Mizoram",
    elevationOrTransit: "1,465 m · 29 km west of Aizawl",
    fieldNote:
      "Start the 45-minute forest trail before 09:00 for clear views of the Mizo hills and traditional heritage huts at the base.",
  },
  place_mz_vantawng: {
    imageUrl: "/places/place_mz_vantawng.jpg",
    imageCaption: "Vantawng Falls near Thenzawl, Mizoram",
    elevationOrTransit: "95 km south of Aizawl via Thenzawl",
    fieldNote:
      "Combine the viewing deck visit with Thenzawl handloom weaving workshops along the Aizawl–Lunglei road.",
  },
  place_sk_gangtok: {
    imageUrl: "/places/place_sk_gangtok.jpg",
    imageCaption: "Gangtok ridge and Khangchendzonga horizon, Sikkim",
    elevationOrTransit: "1,650 m · 4.5 hr drive from New Jalpaiguri (NJP)",
    fieldNote:
      "No permit is needed for Indian citizens visiting Gangtok; foreign nationals register for a Sikkim RAP at Rangpo checkpost.",
  },
  place_sk_tsomgo: {
    imageUrl: "/places/place_sk_tsomgo.jpg",
    imageCaption: "Glacial Lake Tsomgo (Changu) at 3,753 m, East Sikkim",
    elevationOrTransit: "3,753 m · 40 km east of Gangtok",
    fieldNote:
      "Submit two passport photos and voter ID/passport to your registered Gangtok operator a day prior for the Police Checkpost permit.",
  },
  place_sk_yumthang: {
    imageUrl: "/places/place_sk_yumthang.jpg",
    imageCaption: "Yumthang alpine valley above Lachung, North Sikkim",
    elevationOrTransit: "3,564 m · Overnight in Lachung from Gangtok",
    fieldNote:
      "Requires a North Sikkim Protected Area Permit arranged through a Sikkim Tourism registered operator.",
  },
  place_sk_pelling: {
    imageUrl: "/places/place_sk_pelling.jpg",
    imageCaption: "Pemayangtse Monastery near Pelling, West Sikkim",
    elevationOrTransit: "2,150 m · 4.5 hr drive from NJP or Gangtok",
    fieldNote:
      "Open entry for Indian citizens; visit Pemayangtse Monastery and Rabdentse ruins before 16:30.",
  },
  place_tr_ujjayanta: {
    imageUrl: "/places/place_tr_ujjayanta.jpg",
    imageCaption: "Ujjayanta Palace & State Museum, Agartala, Tripura",
    elevationOrTransit: "15 min from Agartala Railway Station (AGTL)",
    fieldNote:
      "No ILP required for Tripura. Museum galleries open 10:00 to 17:00 Tuesday through Sunday (closed Mondays).",
  },
  place_tr_unakoti: {
    imageUrl: "/places/place_tr_unakoti.jpg",
    imageCaption: "7th–9th century rock-cut relief carvings at Unakoti, Tripura",
    elevationOrTransit: "Train to Dharmanagar or Kumarghat, 30 min cab",
    fieldNote:
      "Gates open 07:00 to 17:00. Wear grip footwear for the damp stone steps along the hillside stream.",
  },
  place_tr_neermahal: {
    imageUrl: "/places/place_tr_neermahal.jpg",
    imageCaption: "Neermahal water palace on Rudrasagar Lake, Tripura",
    elevationOrTransit: "53 km south of Agartala at Melaghar",
    fieldNote:
      "Motorboats and rowboats cross from Rajghat jetty between 09:00 and 16:30.",
  },
};

const FALLBACK_STATE_IMAGES: Record<string, string> = {
  AS: "/places/place_as_kaziranga.jpg",
  ML: "/places/place_ml_cherrapunji.jpg",
  AR: "/places/place_ar_tawang.jpg",
  NL: "/places/place_nl_kohima.jpg",
  MN: "/places/place_mn_loktak.jpg",
  MZ: "/places/place_mz_aizawl.jpg",
  TR: "/places/place_tr_unakoti.jpg",
  SK: "/places/place_sk_tsomgo.jpg",
};

export function getPlaceEditorialMeta(placeId: string, stateCode: string, fallbackNotes?: string): EditorialPlaceMeta {
  const hit = PLACE_EDITORIAL_MEDIA[placeId];
  if (hit) return hit;
  return {
    imageUrl: FALLBACK_STATE_IMAGES[stateCode] || FALLBACK_STATE_IMAGES.AS,
    imageCaption: STATE_FULL_NAMES[stateCode] || stateCode,
    elevationOrTransit: STATE_FULL_NAMES[stateCode] || stateCode,
    fieldNote: fallbackNotes || "",
  };
}

export function getPlacePermitSummary(
  stateCode: string,
  permitAreaId: string | null | undefined,
  citizenType: CitizenType = "indian"
): { required: boolean; badgeLabel: string; ctaLabel: string } {
  const st = stateCode.toUpperCase();
  const isForeign = citizenType === "foreign" || citizenType === "oci_pio";

  if (st === "AR" || st === "NL" || st === "MZ" || st === "MN") {
    return {
      required: true,
      badgeLabel: isForeign ? "PAP / RAP required" : "ILP required",
      ctaLabel: isForeign ? "PAP checklist and route" : "ILP checklist and route",
    };
  }

  if (st === "SK") {
    if (isForeign || (permitAreaId && permitAreaId === "area_sk_protected")) {
      return {
        required: true,
        badgeLabel: isForeign ? "RAP required" : "Protected zone permit",
        ctaLabel: "Permit rules and transit",
      };
    }
    return {
      required: false,
      badgeLabel: "Open entry (Gangtok)",
      ctaLabel: "Field guide and transit",
    };
  }

  if (permitAreaId === "area_as_kaziranga") {
    return {
      required: false,
      badgeLabel: "No ILP · Safari booking only",
      ctaLabel: "Range timings and transit",
    };
  }

  return {
    required: false,
    badgeLabel: "No permit required",
    ctaLabel: "Field guide and transit",
  };
}

export function formatCitizenProfileLabel(citizenType?: CitizenType, nationalityCode?: string): string {
  if (!citizenType || citizenType === "indian") {
    return "Indian citizen";
  }
  if (citizenType === "oci_pio") {
    return `OCI / PIO cardholder${nationalityCode ? ` (${nationalityCode})` : ""}`;
  }
  return `Foreign national${nationalityCode ? ` (${nationalityCode})` : ""}`;
}

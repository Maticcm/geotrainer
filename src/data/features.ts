import type { ApproxLocation, FeatureMeta, GeographyCategory } from "@/lib/types";

const NE = "Natural Earth 1:50m (public domain)";
const S = {
  marine: `${NE} – Geography: Marine polygons`,
  regions: `${NE} – Geography: Regions polygons`,
  countries: `${NE} – Admin 0: Countries`,
  subunits: `${NE} – Admin 0: Map subunits`,
  rivers: `${NE} – Rivers + lake centerlines`,
  lakes: `${NE} – Lakes`,
  elev: `${NE} – Geography: Elevation points`,
  derived: `${NE} – derived (see docs/DATA.md)`,
  approx: "Approximate coordinate (no verified geometry bundled)",
};

type Opts = {
  aliases?: string[];
  syllabus?: boolean;
  approx?: ApproxLocation;
  note?: string;
  tol?: number;
};

const list: FeatureMeta[] = [];
function F(
  cat: GeographyCategory,
  id: string,
  name: string,
  nameEn: string,
  difficulty: 1 | 2 | 3,
  source: string,
  sl: string,
  en: string,
  o: Opts = {},
) {
  list.push({
    id,
    category: cat,
    name,
    nameEn,
    aliases: [nameEn, ...(o.aliases ?? [])],
    difficulty,
    source: o.approx ? S.approx : source,
    geometryKind: o.approx ? "approximate" : "geometry",
    approx: o.approx,
    syllabus: o.syllabus ?? true,
    fact: { sl, en },
    note: o.note,
    toleranceKm: o.tol,
  });
}

// 1. Oceani in morja
F("oceans-seas", "indian-ocean", "Indijski ocean", "Indian Ocean", 1, S.marine, "Leži med Afriko, Azijo, Avstralijo in Antarktiko.", "Lies between Africa, Asia, Australia and Antarctica.", { aliases: ["Indijski"] });
F("oceans-seas", "pacific-ocean", "Pacifik", "Pacific Ocean", 1, S.marine, "Največji in najgloblji ocean; med Azijo/Avstralijo in Ameriko.", "Largest and deepest ocean, between Asia/Australia and the Americas.", { aliases: ["Tihi ocean", "Pacifiški ocean"] });
F("oceans-seas", "atlantic-ocean", "Atlantski ocean", "Atlantic Ocean", 1, S.marine, "Med Evropo/Afriko na vzhodu in Ameriko na zahodu.", "Between Europe/Africa in the east and the Americas in the west.", { aliases: ["Atlantik", "Atlantski"] });
F("oceans-seas", "arctic-ocean", "Severno ledeno morje", "Arctic Ocean", 1, S.marine, "Najmanjši ocean okoli severnega tečaja.", "Smallest ocean, around the North Pole.", { aliases: ["Arktični ocean", "Severno ledeno morje"] });
F("oceans-seas", "mediterranean-sea", "Sredozemsko morje", "Mediterranean Sea", 1, S.marine, "Med Evropo, Afriko in Azijo; z Atlantikom ga povezuje Gibraltar.", "Between Europe, Africa and Asia; linked to the Atlantic at Gibraltar.", { aliases: ["Sredozemsko"] });
F("oceans-seas", "red-sea", "Rdeče morje", "Red Sea", 1, S.marine, "Med Afriko in Arabskim polotokom; na severu Sueški prekop.", "Between Africa and the Arabian Peninsula; Suez Canal at its north end.", { aliases: ["Rdeče"] });
F("oceans-seas", "black-sea", "Črno morje", "Black Sea", 1, S.marine, "Med Evropo in Malo Azijo; skozi Bospor povezano s Sredozemljem.", "Between Europe and Asia Minor; linked to the Mediterranean via the Bosporus.", { aliases: ["Črno"] });
F("oceans-seas", "bering-sea", "Beringovo morje", "Bering Sea", 2, S.marine, "Med Sibirijo in Aljasko, severni Pacifik.", "Between Siberia and Alaska, in the northern Pacific.", { aliases: ["Beringovo"] });
F("oceans-seas", "caribbean-sea", "Karibsko morje", "Caribbean Sea", 1, S.marine, "Med Srednjo Ameriko, Venezuelo in Antili.", "Between Central America, Venezuela and the Antilles.", { aliases: ["Karibsko"] });
F("oceans-seas", "arabian-sea", "Arabsko morje", "Arabian Sea", 2, S.marine, "Del Indijskega oceana med Arabskim polotokom in Indijo.", "Part of the Indian Ocean between Arabia and India.", { aliases: ["Arabsko"] });
F("oceans-seas", "south-china-sea", "Južnokitajsko morje", "South China Sea", 2, S.marine, "Ob jugovzhodni Aziji, med Kitajsko, Vietnamom in Filipini.", "Off Southeast Asia, between China, Vietnam and the Philippines.", { aliases: ["Južno kitajsko morje", "Južnokitajsko"] });
F("oceans-seas", "sea-of-japan", "Japonsko morje", "Sea of Japan", 2, S.marine, "Med Japonsko in azijsko celino.", "Between Japan and the Asian mainland.", { aliases: ["Japonsko"] });

// 2. Celine
F("continents", "europe", "Evropa", "Europe", 1, S.regions, "Zahodni del Evrazije; meja z Azijo poteka po Uralu.", "Western part of Eurasia; the Urals mark the border with Asia.");
F("continents", "asia", "Azija", "Asia", 1, S.regions, "Največja celina, od Urala do Pacifika.", "Largest continent, from the Urals to the Pacific.");
F("continents", "australia", "Avstralija", "Australia", 1, S.regions, "Najmanjša celina na južni polobli.", "Smallest continent, in the southern hemisphere.", { aliases: ["Oceanija", "Avstralija in Oceanija", "Oceania"] });
F("continents", "africa", "Afrika", "Africa", 1, S.regions, "Celina med Atlantikom in Indijskim oceanom, prečka jo ekvator.", "Continent between the Atlantic and Indian oceans, crossed by the equator.");
F("continents", "south-america", "Južna Amerika", "South America", 1, S.regions, "Celina med Pacifikom in Atlantikom; vzdolž zahoda tečejo Andi.", "Continent between the Pacific and Atlantic; the Andes run along its west.", { aliases: ["J. Amerika"] });
F("continents", "north-america", "Severna Amerika", "North America", 1, S.regions, "Celina s Kanado, ZDA in Mehiko.", "Continent with Canada, the USA and Mexico.", { aliases: ["S. Amerika"] });
F("continents", "antarctica", "Antarktika", "Antarctica", 1, S.regions, "Ledena celina okoli južnega tečaja.", "Ice-covered continent around the South Pole.", { aliases: ["Antarktis"] });
F("continents", "arctic", "Arktika", "Arctic", 2, S.derived, "Območje okoli severnega tečaja, severno od severnega tečajnika (66,56° S).", "Region around the North Pole, north of the Arctic Circle (66.56°N).", {
  aliases: ["Arktis"],
  note: "Worksheet writes 'Antarktika (Arktika)'. Arktika is not a continent; it is modelled as the region north of the Arctic Circle (derived geometry).",
});

// 3. Gorovja
F("mountains", "himalayas", "Himalaja", "Himalayas", 1, S.regions, "Najvišje gorovje sveta med Indijo in Tibetom; Mount Everest.", "World's highest range between India and Tibet; Mount Everest.", { aliases: ["Himalaje"] });
F("mountains", "alps", "Alpe", "Alps", 1, S.regions, "Gorovje v srednji Evropi, vključno s Slovenijo, Švico in Avstrijo.", "Mountain range in central Europe incl. Slovenia, Switzerland, Austria.", { aliases: ["Alpe"] });
F("mountains", "andes", "Andi", "Andes", 1, S.regions, "Najdaljše gorovje, vzdolž zahodne obale Južne Amerike.", "Longest range, along South America's west coast.");
F("mountains", "ural-mountains", "Ural (gorovje)", "Ural Mountains", 2, S.regions, "Gorovje v Rusiji, meja med Evropo in Azijo.", "Russian range forming the Europe–Asia boundary.", { aliases: ["Ural", "Uralsko gorovje", "Urals"] });
F("mountains", "drakensberg", "Zmajeve gore", "Drakensberg", 3, S.regions, "Gorovje v vzhodni Južni Afriki (JAR, Lesoto).", "Range in eastern South Africa (South Africa, Lesotho).", { aliases: ["Drakensberg", "Zmajeve gore"] });
F("mountains", "rocky-mountains", "Skalno gorovje", "Rocky Mountains", 2, S.regions, "Gorovje v zahodni Severni Ameriki, od Kanade do Mehike.", "Range in western North America, from Canada to the USA.", { aliases: ["Rocky Mountains", "Rocky Mts", "Skalnato gorovje"] });
F("mountains", "scandinavian-mountains", "Skandinavsko gorstvo", "Scandinavian Mountains", 2, S.regions, "Gorovje vzdolž meje Norveške in Švedske.", "Range along the Norway–Sweden border.", { aliases: ["Skandinavsko gorovje", "Kjølen", "Kjolen Mountains"] });
F("mountains", "atlas-mountains", "Atlas", "Atlas Mountains", 2, S.regions, "Gorovje v severozahodni Afriki (Maroko, Alžirija, Tunizija).", "Range in northwest Africa (Morocco, Algeria, Tunisia).", { aliases: ["Atlas gorovje", "Atlas Mts"] });
F("mountains", "kilimanjaro", "Kilimandžaro", "Mount Kilimanjaro", 2, S.elev, "Najvišja gora Afrike (5895 m), v Tanzaniji.", "Highest mountain of Africa (5,895 m), in Tanzania.", { aliases: ["Kilimanjaro", "Kilimandzaro"], tol: 450, note: "A single peak: modelled as a Point from Natural Earth elevation points." });
F("mountains", "caucasus-mountains", "Kavkaz", "Caucasus Mountains", 2, S.regions, "Gorovje med Črnim in Kaspijskim morjem.", "Range between the Black and Caspian seas.", { syllabus: false, aliases: ["Kavkaško gorovje", "Caucasus"], note: "Not on the worksheet; extra from the project brief." });

// 4. Prekopi in ožine
F("canals-straits", "suez-canal", "Sueški prekop", "Suez Canal", 1, S.rivers, "Umetni prekop v Egiptu med Sredozemskim in Rdečim morjem.", "Artificial canal in Egypt linking the Mediterranean and the Red Sea.", { aliases: ["Suez", "Sueški kanal"], tol: 450 });
F("canals-straits", "bosporus", "Bospor", "Bosporus", 2, S.approx, "Ožina v Istanbulu med Črnim in Marmarskim morjem.", "Strait in Istanbul between the Black Sea and the Sea of Marmara.", { aliases: ["Bosporus", "Bosphorus", "Bosporska ožina"], approx: { lat: 41.12, lng: 29.07, toleranceKm: 420 }, note: "Too narrow for Natural Earth; approximate point." });
F("canals-straits", "dardanelles", "Dardanele", "Dardanelles", 2, S.approx, "Ožina med Egejskim in Marmarskim morjem, v severozahodni Turčiji.", "Strait between the Aegean and the Sea of Marmara in NW Turkey.", { aliases: ["Dardanelle", "Hellespont"], approx: { lat: 40.2, lng: 26.4, toleranceKm: 420 }, note: "Too narrow for Natural Earth; approximate point." });
F("canals-straits", "panama-canal", "Panamski prekop", "Panama Canal", 1, S.rivers, "Prekop čez Panamo med Atlantikom (Karibi) in Pacifikom.", "Canal across Panama linking the Atlantic (Caribbean) and the Pacific.", { aliases: ["Panamski kanal"], tol: 450 });
F("canals-straits", "strait-of-gibraltar", "Gibraltar", "Strait of Gibraltar", 1, S.marine, "Ožina med Španijo in Marokom; Atlantik – Sredozemlje.", "Strait between Spain and Morocco; Atlantic – Mediterranean.", { aliases: ["Gibraltarska ožina", "Gibraltar"], tol: 450 });

// 5. Države
F("countries", "canada", "Kanada", "Canada", 1, S.countries, "Druga največja država na svetu; prestolnica Ottawa.", "Second-largest country; capital Ottawa.");
F("countries", "usa", "ZDA", "United States", 1, S.countries, "Združene države Amerike; prestolnica Washington.", "United States of America; capital Washington, D.C.", { aliases: ["Združene države Amerike", "USA", "United States of America", "Amerika"] });
F("countries", "china", "Kitajska", "China", 1, S.countries, "Najbolj naseljena azijska država; prestolnica Peking.", "Huge East Asian country; capital Beijing.");
F("countries", "japan", "Japonska", "Japan", 1, S.countries, "Otoška država v vzhodni Aziji; Honšu, Hokaido, Kjušu, Šikoku.", "East Asian island country: Honshu, Hokkaido, Kyushu, Shikoku.");
F("countries", "india", "Indija", "India", 1, S.countries, "Država južne Azije; prestolnica New Delhi.", "South Asian country; capital New Delhi.");
F("countries", "south-africa", "JAR", "South Africa", 1, S.countries, "Južnoafriška republika na južnem koncu Afrike.", "Republic at the southern tip of Africa.", { aliases: ["Južnoafriška republika", "Južna Afrika"] });
F("countries", "united-kingdom", "VB", "United Kingdom", 1, S.countries, "Velika Britanija s Severno Irsko; otok severozahodno od Evrope.", "Great Britain plus Northern Ireland, off NW Europe.", { aliases: ["Velika Britanija", "Združeno kraljestvo", "UK", "Britanija", "Great Britain"] });
F("countries", "italy", "Italija", "Italy", 1, S.countries, "Čevljasti polotok v južni Evropi; prestolnica Rim.", "Boot-shaped peninsula in southern Europe; capital Rome.");
F("countries", "egypt", "Egipt", "Egypt", 1, S.countries, "Država v severovzhodni Afriki ob Nilu.", "North-east African country along the Nile.");
F("countries", "brazil", "Brazilija", "Brazil", 1, S.countries, "Največja država Južne Amerike.", "Largest country in South America.");
F("countries", "peru", "Peru", "Peru", 2, S.countries, "Andska država ob Pacifiku; Machu Picchu.", "Andean country on the Pacific; Machu Picchu.");
F("countries", "chile", "Čile", "Chile", 2, S.countries, "Dolga ozka država ob Pacifiku v Južni Ameriki.", "Long narrow country on South America's Pacific coast.", { aliases: ["Cile"] });
F("countries", "mexico", "Mehika", "Mexico", 1, S.countries, "Južno od ZDA; prestolnica Ciudad de México.", "South of the USA; capital Mexico City.");
F("countries", "argentina", "Argentina", "Argentina", 1, S.countries, "Druga največja država Južne Amerike.", "Second-largest country in South America.");
F("countries", "spain", "Španija", "Spain", 1, S.countries, "Večji del Iberskega polotoka; prestolnica Madrid.", "Most of the Iberian Peninsula; capital Madrid.");
F("countries", "saudi-arabia", "Saudova Arabija", "Saudi Arabia", 2, S.countries, "Največja država Arabskega polotoka.", "Largest country on the Arabian Peninsula.", { aliases: ["Saudska Arabija"] });

// 6. Reke
F("rivers", "niger-river", "Niger", "Niger River", 2, S.rivers, "Glavna reka Zahodne Afrike; v Gvinejski zaliv.", "Main river of West Africa; flows into the Gulf of Guinea.", { aliases: ["Reka Niger"] });
F("rivers", "nile", "Nil", "Nile", 1, S.rivers, "Najdaljša reka v Afriki; teče skozi Egipt v Sredozemsko morje.", "Longest river in Africa; flows through Egypt into the Mediterranean.");
F("rivers", "mississippi", "Misisipi", "Mississippi", 1, S.rivers, "Glavna reka ZDA; v Mehiški zaliv.", "Main river of the USA; into the Gulf of Mexico.", { aliases: ["Mississippi"] });
F("rivers", "colorado-river", "Kolorado", "Colorado River", 2, S.rivers, "Reka v jugozahodnih ZDA; Grand Canyon.", "River in the south-western USA; Grand Canyon.", { aliases: ["Colorado"] });
F("rivers", "rio-grande", "Rio Grande", "Rio Grande", 2, S.rivers, "Meja med ZDA in Mehiko; v Mehiški zaliv.", "Border between the USA and Mexico; into the Gulf of Mexico.", { aliases: ["Rio Grande"] });
F("rivers", "saint-lawrence-river", "Reka Sv. Lovrenca", "Saint Lawrence River", 2, S.rivers, "Odtok Velikih jezer v Atlantik (Kanada).", "Outflow of the Great Lakes to the Atlantic (Canada).", { aliases: ["Sv. Lovrenca", "Sveti Lovrenc", "St. Lawrence", "Saint Lawrence"] });
F("rivers", "amazon", "Amazonka", "Amazon", 1, S.rivers, "Najbolj vodnata reka sveta; Brazilija – Atlantik.", "World's greatest river by volume; Brazil – Atlantic.", { aliases: ["Amazon", "Amazonas"] });
F("rivers", "parana", "Parana", "Paraná", 2, S.rivers, "Reka v Braziliji, Paragvaju in Argentini; tvori Río de la Plata.", "River in Brazil, Paraguay and Argentina; forms the Río de la Plata.", { aliases: ["Paraná"] });
F("rivers", "orinoco", "Orinoko", "Orinoco", 2, S.rivers, "Glavna reka Venezuele; v Atlantik.", "Main river of Venezuela; into the Atlantic.", { aliases: ["Orinoco"] });
F("rivers", "rhine", "Ren", "Rhine", 1, S.rivers, "Iz Alp skozi Nemčijo in Nizozemsko v Severno morje.", "From the Alps through Germany and the Netherlands to the North Sea.", { aliases: ["Rhein"] });
F("rivers", "danube", "Donava", "Danube", 1, S.rivers, "Druga najdaljša evropska reka; v Črno morje.", "Europe's second-longest river; into the Black Sea.", { aliases: ["Donau"] });
F("rivers", "ural-river", "Ural (reka)", "Ural River", 3, S.rivers, "Iz južnega Urala v Kaspijsko jezero.", "From the southern Urals to the Caspian Sea.", { aliases: ["Ural", "Reka Ural"] });
F("rivers", "euphrates", "Evfrat", "Euphrates", 2, S.rivers, "Iz Turčije skozi Sirijo in Irak; z Tigrisom Mezopotamija.", "From Turkey through Syria and Iraq; with the Tigris forms Mesopotamia.", { aliases: ["Euphrat"] });
F("rivers", "tigris", "Tigris", "Tigris", 2, S.rivers, "Iz Turčije skozi Irak (Bagdad) v Perzijski zaliv.", "From Turkey through Iraq (Baghdad) to the Persian Gulf.");
F("rivers", "yangtze", "Modra reka", "Yangtze", 2, S.rivers, "Jangce – najdaljša reka Azije, Kitajska (Šanghaj).", "The Yangtze – longest river in Asia, China (Shanghai).", { aliases: ["Jangce", "Yangtze", "Chang Jiang", "Blue River"], note: "'Modra reka' = Yangtze (Chang Jiang), not the Blue Nile." });
F("rivers", "yellow-river", "Rumena reka", "Yellow River", 2, S.rivers, "Huang He – druga najdaljša reka Kitajske, v Rumeno morje (Bohaj).", "The Huang He – China's second-longest river, into the Bohai Sea.", { aliases: ["Huang He", "Hoang Ho", "Huang", "Huanghe", "Yellow"], note: "'Rumena reka' = Huang He (Yellow River), not a 'Red Nile'. No river called 'Red Nile' exists." });
F("rivers", "mekong", "Mekong", "Mekong", 2, S.rivers, "Iz Tibeta skozi jugovzhodno Azijo v Južnokitajsko morje.", "From Tibet through Southeast Asia to the South China Sea.");
F("rivers", "ganges", "Ganges", "Ganges", 1, S.rivers, "Sveta reka Indije; v Bengalski zaliv.", "India's sacred river; into the Bay of Bengal.");
F("rivers", "brahmaputra", "Brahmaputra", "Brahmaputra", 3, S.rivers, "Iz Tibeta skozi Indijo in Bangladeš; združi se z Gangesom.", "From Tibet through India and Bangladesh; joins the Ganges.");
F("rivers", "congo-river", "Kongo", "Congo River", 2, S.rivers, "Najbolj vodnata afriška reka; ekvatorialna Afrika.", "Africa's most voluminous river; equatorial Africa.", { aliases: ["Congo"] });
F("rivers", "indus", "Ind", "Indus", 2, S.rivers, "Iz Tibeta skozi Pakistan v Arabsko morje.", "From Tibet through Pakistan to the Arabian Sea.", { aliases: ["Indus"] });
F("rivers", "blue-nile", "Modri Nil", "Blue Nile", 3, S.rivers, "Pritok Nila iz Etiopije; združi se z Belim Nilom v Kartumu.", "Nile tributary from Ethiopia; joins the White Nile at Khartoum.", { syllabus: false, aliases: ["Blue Nile", "Abay"], note: "Not on the worksheet; extra from the project brief." });

// 7. Jezera
F("lakes", "great-lakes", "Velika jezera", "Great Lakes", 1, S.lakes, "Zgornje, Huronsko, Michigansko, Erie in Ontario – med ZDA in Kanado.", "Superior, Huron, Michigan, Erie and Ontario – USA/Canada border.", { aliases: ["Great Lakes"] });
F("lakes", "lake-titicaca", "Titicaca", "Lake Titicaca", 2, S.lakes, "Najvišje plovno jezero; Peru in Bolivija v Andih.", "Highest navigable lake; Peru/Bolivia in the Andes.", { aliases: ["Jezero Titicaca"] });
F("lakes", "lake-victoria", "Viktorijino jezero", "Lake Victoria", 2, S.lakes, "Največje afriško jezero; Uganda, Kenija, Tanzanija.", "Africa's largest lake; Uganda, Kenya, Tanzania.", { aliases: ["Viktorijino", "Viktorijino jezero"] });
F("lakes", "lake-baikal", "Bajkalsko jezero", "Lake Baikal", 2, S.lakes, "Najgloblje jezero na svetu; Sibirija.", "World's deepest lake; Siberia.", { aliases: ["Bajkal", "Bajkalsko"] });
F("lakes", "caspian-sea", "Kaspijsko jezero", "Caspian Sea", 1, S.marine, "Največje celinsko jezero na svetu; med Evropo in Azijo.", "World's largest inland body of water; Europe/Asia border.", { aliases: ["Kaspijsko morje", "Kaspijsko", "Caspian Lake"], note: "The brief lists it under seas and lakes; the worksheet lists it only under lakes." });
F("lakes", "lake-tanganyika", "Tanganjiško jezero", "Lake Tanganyika", 3, S.lakes, "Dolgo jezero v afriški tektonski udorini; drugo najgloblje na svetu.", "Long Rift Valley lake; second-deepest in the world.", { aliases: ["Tanganjika", "Tanganjiško"] });
F("lakes", "lake-malawi", "Malavijsko jezero", "Lake Malawi", 3, S.lakes, "Jezero v afriški tektonski udorini; Malavi, Mozambik, Tanzanija.", "Rift Valley lake; Malawi, Mozambique, Tanzania.", { aliases: ["Malavi", "Malavijsko", "Lake Nyasa"] });
F("lakes", "finnish-lakeland", "Dežela 1000-ih jezer", "Finnish Lakeland", 2, S.derived, "Jezerska pokrajina v južni in osrednji Finski.", "Lake district of southern and central Finland.", { aliases: ["Dežela 1000-erih jezer", "Dežela tisoč jezer", "Finska", "Thousand Lakes Region", "Finland Lake District", "Dežela 1000 jezer"], tol: 420, note: "'Thousand Lakes' is a region, not one lake. Modelled as the union of Natural Earth lakes in southern/central Finland (derived)." });
F("lakes", "aral-sea", "Aralsko jezero", "Aral Sea", 2, S.lakes, "Izsušeno jezero med Kazahstanom in Uzbekistanom.", "Drying lake between Kazakhstan and Uzbekistan.", { aliases: ["Aralsko", "Aralsko morje"] });
F("lakes", "lake-chad", "Čadsko jezero", "Lake Chad", 3, S.lakes, "Plitvo jezero na robu Sahare v Čadu, Nigru, Nigeriji in Kamerunu.", "Shallow lake on the Sahara's edge: Chad, Niger, Nigeria, Cameroon.", { syllabus: false, aliases: ["Lake Chad", "Čad"], note: "Not on the worksheet; extra from the project brief." });

// 8. Otočja
F("islands", "tasmania", "Tasmanija", "Tasmania", 2, S.subunits, "Otok južno od Avstralije.", "Island south of mainland Australia.");
F("islands", "new-zealand", "Nova Zelandija", "New Zealand", 1, S.subunits, "Severni in Južni otok v jugozahodnem Pacifiku.", "North and South Island in the south-west Pacific.", { aliases: ["Nova Zelandija"] });
F("islands", "sri-lanka", "Šrilanka", "Sri Lanka", 1, S.subunits, "Otok jugovzhodno od Indije.", "Island south-east of India.", { aliases: ["Sri Lanka", "Cejlon"] });
F("islands", "madagascar", "Madagaskar", "Madagascar", 1, S.subunits, "Največji otok ob Afriki, v Indijskem oceanu.", "Africa's largest island, in the Indian Ocean.");
F("islands", "corsica", "Korzika", "Corsica", 2, S.subunits, "Francoski otok v Sredozemlju, severno od Sardinije.", "French island in the Mediterranean north of Sardinia.", { aliases: ["Corse"] });
F("islands", "sicily", "Sicilija", "Sicily", 1, S.subunits, "Največji otok v Sredozemlju, pri južni konici Italije.", "Largest Mediterranean island, off Italy's toe.", { aliases: ["Sicilia"] });
F("islands", "sardinia", "Sardinija", "Sardinia", 2, S.subunits, "Otok v Sredozemlju zahodno od Italije.", "Mediterranean island west of Italy.", { aliases: ["Sardegna"] });
F("islands", "balearic-islands", "Baleari", "Balearic Islands", 2, S.subunits, "Otočje v Sredozemlju pred Španijo (Mallorca, Ibiza).", "Archipelago off Spain (Mallorca, Ibiza).", { aliases: ["Balearski otoki", "Mallorca", "Baleari"] });
F("islands", "cuba", "Kuba", "Cuba", 1, S.subunits, "Največji otok Karibov.", "Largest island of the Caribbean.");
F("islands", "iceland", "Islandija", "Iceland", 1, S.subunits, "Vulkanski otok v severnem Atlantiku.", "Volcanic island in the North Atlantic.");
F("islands", "greenland", "Grenlandija", "Greenland", 1, S.subunits, "Največji otok na svetu, pod danskim okriljem.", "World's largest island, self-governing within Denmark.");
F("islands", "maldives", "Maldivi", "Maldives", 3, S.subunits, "Atoli v Indijskem oceanu jugozahodno od Indije.", "Atolls in the Indian Ocean south-west of India.", { tol: 500 });
F("islands", "seychelles", "Sejšeli", "Seychelles", 3, S.subunits, "Otočje v Indijskem oceanu severno od Madagaskarja.", "Archipelago in the Indian Ocean north of Madagascar.", { tol: 500 });
F("islands", "new-guinea", "Nova Gvineja", "New Guinea", 2, S.regions, "Drugi največji otok na svetu; Papua Nova Gvineja in Indonezija.", "World's second-largest island; Papua New Guinea and Indonesia.");
F("islands", "philippines", "Filipini", "Philippines", 1, S.subunits, "Otočje v jugovzhodni Aziji.", "Archipelago in Southeast Asia.");
F("islands", "taiwan", "Tajvan", "Taiwan", 1, S.subunits, "Otok vzhodno od Kitajske.", "Island east of mainland China.");

// 9. Puščave in polpuščave
F("deserts", "sahara", "Sahara", "Sahara", 1, S.regions, "Največja vroča puščava sveta, severna Afrika.", "World's largest hot desert, northern Africa.");
F("deserts", "kalahari", "Kalahari", "Kalahari", 2, S.regions, "Polpuščava v Bocvani, Namibiji in JAR.", "Semi-desert in Botswana, Namibia and South Africa.");
F("deserts", "namib", "Namib", "Namib", 2, S.regions, "Obalna puščava v Namibiji ob Atlantiku.", "Coastal desert in Namibia on the Atlantic.");
F("deserts", "gobi", "Gobi", "Gobi", 2, S.regions, "Puščava med Mongolijo in Kitajsko.", "Desert between Mongolia and China.");
F("deserts", "death-valley", "Dolina smrti", "Death Valley", 3, S.approx, "Vroča kotlina v Kaliforniji (ZDA), najnižja točka Severne Amerike.", "Hot basin in California (USA), lowest point of North America.", { aliases: ["Death Valley"], approx: { lat: 36.45, lng: -116.85, toleranceKm: 400 }, note: "No bundled polygon; approximate coordinate in California/Nevada border region." });
F("deserts", "atacama", "Atakama", "Atacama", 2, S.regions, "Najbolj suha puščava na svetu, severni Čile.", "One of the driest deserts, northern Chile.", { aliases: ["Atacama"] });
F("deserts", "simpson-desert", "Velika Simpsonova puščava", "Simpson Desert", 3, S.approx, "Puščava v osrednji Avstraliji.", "Desert in central Australia.", { aliases: ["Simpsonova puščava", "Great Simpson Desert", "Simpson Desert"], approx: { lat: -25.0, lng: 137.0, toleranceKm: 450 }, note: "No bundled polygon; approximate centre of the desert." });
F("deserts", "arabian-desert", "Arabska puščava", "Arabian Desert", 2, S.regions, "Puščave Arabskega polotoka; največji peščeni del je Rub al Hali.", "Deserts of the Arabian Peninsula; largest sand sea is the Rub' al Khali.", { aliases: ["Rub al Hali", "Rub al Khali", "Arabska"], note: "Geometry covers the Rub' al Khali only (largest part); the whole Arabian Desert is larger." });

// 10. Polotoki
F("peninsulas", "california-peninsula", "Kalifornijski polotok", "California Peninsula", 2, S.regions, "Baja California v Mehiki, med Pacifikom in Kalifornijskim zalivom.", "Baja California in Mexico, between the Pacific and the Gulf of California.", { aliases: ["Baja California", "Kalifornijski"], note: "Interpreted as Baja California (the 'California Peninsula')." });
F("peninsulas", "deccan-peninsula", "Dekanski polotok", "Deccan Peninsula", 2, S.regions, "Južni del Indije med Arabskim morjem in Bengalskim zalivom.", "Southern India between the Arabian Sea and Bay of Bengal.", { aliases: ["Dekan", "Deccan", "Deccan Plateau", "Dekanski"], note: "Geometry is the Natural Earth Deccan Plateau region (interior of the peninsula)." });
F("peninsulas", "iberian-peninsula", "Pirenejski polotok", "Iberian Peninsula", 1, S.regions, "Španija in Portugalska; severno Pireneji.", "Spain and Portugal; Pyrenees to the north.", { aliases: ["Iberski polotok", "Pirenejski", "Pyrenean Peninsula"], note: "'Pirenejski polotok' is the Slovenian name for the Iberian Peninsula." });
F("peninsulas", "balkan-peninsula", "Balkanski polotok", "Balkan Peninsula", 1, S.regions, "Jugovzhodna Evropa med Jadranskim, Egejskim in Črnim morjem.", "South-east Europe between the Adriatic, Aegean and Black seas.", { aliases: ["Balkan", "Balkanski"] });
F("peninsulas", "scandinavian-peninsula", "Skandinavski polotok", "Scandinavian Peninsula", 1, S.regions, "Norveška in Švedska.", "Norway and Sweden.", { aliases: ["Skandinavija", "Skandinavski"] });
F("peninsulas", "apennine-peninsula", "Apeninski polotok", "Apennine Peninsula", 1, S.derived, "Italijanski polotok, po katerem tečejo Apenini.", "The Italian peninsula, spine formed by the Apennines.", { aliases: ["Apenninski polotok", "Apeninski", "Italijanski polotok", "Italian Peninsula"], note: "Derived: mainland Italy clipped at 44.2°N." });
F("peninsulas", "indochinese-peninsula", "Indokitajski polotok", "Indochinese Peninsula", 2, S.regions, "Vietnam, Laos, Kambodža, Tajska, Mjanmar.", "Vietnam, Laos, Cambodia, Thailand, Myanmar.", { aliases: ["Indokitajska", "Indochina", "Indokitajski"] });
F("peninsulas", "arabian-peninsula", "Arabski polotok", "Arabian Peninsula", 1, S.regions, "Največji polotok na svetu, med Rdečim morjem in Perzijskim zalivom.", "World's largest peninsula, between the Red Sea and Persian Gulf.", { aliases: ["Arabija", "Arabski"] });

export const FEATURES: readonly FeatureMeta[] = list;
export const FEATURE_BY_ID: ReadonlyMap<string, FeatureMeta> = new Map(list.map((f) => [f.id, f]));
export const SYLLABUS_FEATURES = list.filter((f) => f.syllabus);

export function featuresInCategory(cat: GeographyCategory, syllabusOnly = false): FeatureMeta[] {
  return list.filter((f) => f.category === cat && (!syllabusOnly || f.syllabus));
}

/** Terms from the worksheet that could not be mapped 1:1 to verified geometry. */
export const UNRESOLVED_REPORT: { term: string; status: "approximate" | "interpreted" | "not-found"; detail: string }[] = [
  { term: "Bospor", status: "approximate", detail: "Too narrow for 1:50m data; approximate point (±420 km)." },
  { term: "Dardanele", status: "approximate", detail: "Too narrow for 1:50m data; approximate point (±420 km)." },
  { term: "Dolina smrti", status: "approximate", detail: "No polygon bundled; approximate coordinate (±400 km)." },
  { term: "Velika Simpsonova puščava", status: "approximate", detail: "No polygon bundled; approximate centre (±450 km)." },
  { term: "Arabska puščava", status: "interpreted", detail: "Geometry covers Arabian desert plateaus (Nafud to Rub' al Khali)." },
  { term: "Arktika", status: "interpreted", detail: "Not a continent; region north of the Arctic Circle (derived)." },
  { term: "Dežela 1000-ih jezer", status: "interpreted", detail: "Region; union of Finnish lakes (derived)." },
  { term: "Kalifornijski polotok", status: "interpreted", detail: "Baja California." },
  { term: "Dekanski polotok", status: "interpreted", detail: "Entire southern Indian peninsula below 21°N to Cape Comorin." },
  { term: "Apeninski polotok", status: "interpreted", detail: "Italy mainland clipped at 44.2°N (derived)." },
  { term: "Modra reka / Rumena reka", status: "interpreted", detail: "Yangtze / Yellow River (Huang He), not the Blue Nile." },
  { term: "Red Nile (brief)", status: "not-found", detail: "No such river exists; the worksheet term 'Rumena reka' is the Yellow River. Blue Nile kept as non-syllabus extra." },
];

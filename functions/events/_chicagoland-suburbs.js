/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed
without written permission from The Greek Directory. Unauthorized use, copying, modification,
or distribution of this code can result in legal action to the fullest extent permitted by law.
*/

// functions/events/_chicagoland-suburbs.js
//
// City list for the /events/chicago regional page. Underscore-prefixed
// filename so Cloudflare Pages does NOT treat this as a routable
// function of its own — Pages only maps files that export an onRequest*
// handler to a route; this file exports plain data instead, but the
// underscore is kept as an explicit, greppable signal ("this is a helper
// module living inside a Functions directory, not a route") for anyone
// scanning the functions/ tree later.
//
// This is copied VERBATIM from the array supplied in the events system
// spec — do not re-derive, re-sort, or "clean up" spelling/spacing here;
// this exact list (including entries like "Symphony Center" and
// "Turnberry", which read like landmarks/developments rather than
// incorporated municipalities, and apparent duplicates-with-typos like
// "Bowdre" and "Lake Blossom") is the authoritative source of truth
// supplied by the site owner. If the list needs correcting, that
// correction should happen deliberately in this one file, not silently
// as a side effect of some other change — every other regional grouping
// this system might add later should follow the same pattern: one
// exported array, one file, one clear owner of that list's contents.
//
// Matched case-sensitively against events.city in
// get_events_by_cities() — Postgres text equality is case-sensitive by
// default, so an event whose city was entered as "oak park" instead of
// "Oak Park" will NOT match this list. The admin portal's Events form
// should encourage/normalize proper-case city entry (see the events
// admin snippet) to keep this matching reliable; this file intentionally
// does not attempt case-insensitive matching itself, since ILIKE across
// a 260-entry list is a meaningfully worse query plan than a plain
// equality IN-list for no real benefit if city entry is kept consistent
// at the source.

export const CHICAGOLAND_SUBURBS = [
    "Addison", "Algonquin", "Alsip", "Antioch", "Arlington Heights", "Aurora",
    "Bannockburn", "Barrington", "Barrington Hills", "Bartlett", "Batavia", "Beach Park",
    "Bedford Park", "Beecher", "Bellwood", "Bensenville", "Berkeley", "Berwyn",
    "Bloomingdale", "Blue Island", "Bolingbrook", "Bowdre", "Braidwood", "Bridgeview",
    "Broadview", "Brookfield", "Buffalo Grove", "Burbank", "Burnham", "Burr Ridge",
    "Calumet City", "Calumet Park", "Campton Hills", "Carol Stream", "Carpentersville", "Cary",
    "Cedar Lake", "Channahon", "Chicago Heights", "Chicago Ridge", "Cicero", "Clarendon Hills",
    "Country Club Hills", "Countryside", "Crest Hill", "Crestwood", "Crete", "Crystal Lake",
    "Darien", "Deer Park", "Deerfield", "Des Plaines", "Diamond", "Dixmoor",
    "Dolton", "Downers Grove", "Dyer", "East Chicago", "East Dundee", "East Hazel Crest",
    "Elburn", "Elgin", "Elk Grove Village", "Elmhurst", "Elmwood Park", "Evanston",
    "Evergreen Park", "Flossmoor", "Ford Heights", "Forest Park", "Forest View", "Fox Lake",
    "Fox River Grove", "Frankfort", "Franklin Park", "Gary", "Geneva", "Gilberts",
    "Glen Ellyn", "Glencoe", "Glendale Heights", "Glenview", "Glenwood", "Godley",
    "Golf", "Grayslake", "Green Oaks", "Gurnee", "Hammond", "Hainesville",
    "Hampshire", "Hanover Park", "Harvard", "Harvey", "Harwood Heights", "Hawthorn Woods",
    "Hazel Crest", "Hebron", "Hickory Hills", "Highland", "Highland Park", "Highwood",
    "Hillside", "Hinsdale", "Hodgkins", "Hoffman Estates", "Hometown", "Homewood",
    "Huntley", "Indian Head Park", "Inverness", "Island Lake", "Itasca", "Johnsburg",
    "Joliet", "Justice", "Kankakee", "Kenilworth", "Kildeer", "La Grange",
    "La Grange Park", "Lake Barrington", "Lake Blossom", "Lake Bluff", "Lake Forest", "Lake In The Hills",
    "Lake Station", "Lake Villa", "Lake Zurich", "Lakemoor", "Lakewood", "Lansing",
    "Lemont", "Libertyville", "Lily Lake", "Lincolnshire", "Lincolnwood", "Lindenhurst",
    "Lisbon", "Lisle", "Lockport", "Lombard", "Long Grove", "Lynwood",
    "Lyons", "Manhattan", "Maple Park", "Marengo", "Markham", "Matteson",
    "Maywood", "McCook", "McCullom Lake", "McHenry", "Melrose Park", "Merrillville",
    "Merrionette Park", "Midlothian", "Minooka", "Mokena", "Monee", "Montgomery",
    "Morris", "Morton Grove", "Mount Prospect", "Mundelein", "Munster", "Naperville",
    "New Lenox", "Niles", "Norridge", "North Aurora", "North Chicago", "North Riverside",
    "Northbrook", "Northfield", "Northlake", "Oak Brook", "Oak Forest", "Oak Lawn",
    "Oak Park", "Oakwood Hills", "Olympia Fields", "Orland Hills", "Orland Park", "Oswego",
    "Palatine", "Palos Heights", "Palos Hills", "Palos Park", "Park City", "Park Forest",
    "Park Ridge", "Peotone", "Phoenix", "Pingree Grove", "Plainfield", "Posen",
    "Prairie Grove", "Prospect Heights", "Richmond", "Richton Park", "Ringwood", "River Forest",
    "River Grove", "Riverdale", "Riverside", "Riverwoods", "Robbins", "Rockdale",
    "Rolling Meadows", "Romeoville", "Roselle", "Rosemont", "Round Lake", "Round Lake Beach",
    "Round Lake Heights", "Round Lake Park", "Sauk Village", "Schaumburg", "Schiller Park", "Schererville",
    "Shorewood", "Skokie", "Sleepy Hollow", "South Barrington", "South Chicago Heights", "South Elgin",
    "South Holland", "Spring Grove", "St. Charles", "Steger", "Stickney", "Stone Park",
    "Streamwood", "Sugar Grove", "Summit", "Symphony Center", "Symerton", "Third Lake",
    "Thornton", "Tinley Park", "Tower Lakes", "Trout Valley", "Turnberry", "University Park",
    "Valparaiso", "Vernon Hills", "Villa Park", "Volo", "Wadsworth", "Warrenville",
    "Wauconda", "Waukegan", "Wayne", "West Chicago", "West Dundee", "Westchester",
    "Western Springs", "Westmont", "Wheaton", "Wheeling", "Whiting", "Willow Springs",
    "Willowbrook", "Wilmette", "Wilmington", "Winfield", "Winthrop Harbor", "Winnetka",
    "Wood Dale", "Woodridge", "Woodstock", "Worth", "Yorkville", "Zion",
];

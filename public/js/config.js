// This file holds configuration data.
export const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY_HERE";

// This is our authoritative source for UI dropdowns.
export const somaliAdministrativeHierarchy = {
    "Banaadir": {
        displayName: "Banaadir",
        aliases: ["banadir", "banaadir", "mogadishu"],
        cities: {
            "Mogadishu": {
                displayName: "Mogadishu",
                aliases: ["mogadishu", "xamar", "hamar"],
                districts: {
                    "Abdiaziz": { displayName: "Abdiaziz", aliases: ["abdiaziz"], neighborhoods: [] },
                    "Bondhere": { displayName: "Bondhere", aliases: ["bondhere"], neighborhoods: [] },
                    "Daynile": { displayName: "Daynile", aliases: ["daynile"], neighborhoods: [] },
                    "Dharkenley": { displayName: "Dharkenley", aliases: ["dharkenley"], neighborhoods: [] },
                    "Hamar Jajab": { displayName: "Hamar Jajab", aliases: ["hamar jajab"], neighborhoods: [] },
                    "Hamar Weyne": { displayName: "Hamar Weyne", aliases: ["hamar weyne"], neighborhoods: [] },
                    "Hodan": { displayName: "Hodan", aliases: ["hodan"], neighborhoods: ["Taleh", "Al-Baraka", "Siinay"] },
                    "Hawle Wadag": { displayName: "Hawle Wadag", aliases: ["hawle wadag"], neighborhoods: [] },
                    "Huriwa": { displayName: "Huriwa", aliases: ["huriwa"], neighborhoods: [] },
                    "Karan": { displayName: "Karan", aliases: ["karan"], neighborhoods: [] },
                    "Shibis": { displayName: "Shibis", aliases: ["shibis"], neighborhoods: [] },
                    "Shangani": { displayName: "Shangani", aliases: ["shangani"], neighborhoods: ["Ansaloti", "Shabelle"] },
                    "Waberi": { displayName: "Waberi", aliases: ["waberi"], neighborhoods: ["21st October", "Hawo Tako"] },
                    "Wadajir": { displayName: "Wadajir", aliases: ["wadajir"], neighborhoods: [] },
                    "Wardhigley": { displayName: "Wardhigley", aliases: ["wardhigley"], neighborhoods: [] },
                    "Yaqshid": { displayName: "Yaqshid", aliases: ["yaqshid"], neighborhoods: [] },
                    "Kaxda": { displayName: "Kaxda", aliases: ["kaxda"], neighborhoods: [] }
                }
            }
        }
    },
    "Woqooyi Galbeed": {
        displayName: "Woqooyi Galbeed",
        aliases: ["woqooyi galbeed", "hargeisa"],
        cities: {
            "Hargeisa": {
                displayName: "Hargeisa",
                aliases: ["hargeisa", "hargeysa"],
                districts: {
                    "Gaan Libah": { displayName: "Gaan Libah", aliases: ["gaan libah"], neighborhoods: [] },
                    "26th June": { displayName: "26th June", aliases: ["26th june"], neighborhoods: [] }
                }
            }
        }
    }
};

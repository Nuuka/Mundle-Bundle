const fetch = require("node-fetch-commonjs");
const fs = require("fs/promises");
const path = require("path");
const google = require("google-sr");

const HUMBLE_COOKIE =  ""// Add your Humble Cookie here

const gameKeyDataFilePath = path.join("nodejs/json", "game_key_data.json");
const gameListFilePath = path.join("nodejs/json", "humble_game_list.json");

(async () => {
    try {
        let gameListFile = await fs.access(gameListFilePath).then(() => true).catch(() => false);
        let gamesList = gameListFile ? JSON.parse((await fs.readFile(gameListFilePath)).toString()) : {};

        if (Object.values(gamesList).length == 0) {
            let gamekeys = await getGameKeys();
            let gamekeyData = await getGameKeyData(gamekeys);
            gameList = getUndredeemedGames(gamekeyData);

            //Get undredeemed games from monthly choice
            let choiceUrls = [];
            let choiceData = Object.values(gamekeyData).filter((v) => v.product.choice_url != undefined);
            choiceData.map((v) => choiceUrls.push(v.product.choice_url));
            for (const url of choiceUrls) {
                console.log("Processing: " + url);
                let list = await getChoiceGames("https://www.humblebundle.com/membership/" + url);
                list.map((v) => gamesList.push(v));
            }

            const jsonString = JSON.stringify(gamesList);
            fs.writeFile(gameListFilePath, jsonString, "utf8", (err) => {
                if (err) console.error("Error writing humble_game_list.json file:", err);
                else console.log("File humble_game_list.json saved successfully!");
            });
        }

        for (const [i,game] of Object.values(gamesList).filter((k) => k.steam_app_id == null).entries()) {
            let result = await google.search({ query: game.title + " steam" });
            result = result.filter((r) => r.link.includes("steam") && r.link.includes("/app/"));
            if (result.length != 0) {
                let regex = /\/app\/(\d+)/;
                let match = result[0].link.match(regex);
                if (match) game.steam_app_id = parseInt(match[1]);
            }
        }

         const jsonString = JSON.stringify(gamesList);
        fs.writeFile(gameListFilePath, jsonString, "utf8", (err) => {
            if (err) console.error("Error writing humble_game_list.json file:", err);
            else console.log("File humble_game_list.json saved successfully!");
        });
    } catch (error) {
        console.error(error);
    }
})();

// Attempt to get the JSON Data for the gamekeys for the user
// gamekeys here represent each line in the table in https://www.humblebundle.com/home/keys
async function getGameKeys() {
    let response = await humbleFetch("https://www.humblebundle.com/home/keys");
    let data = await response.text();

    let regex = /<script\s+id="user-home-json-data"\s+type="application\/json">([\s\S]*?)<\/script>/;
    let matches = data.match(regex);

    if (!matches) {
        console.log("No gamekeys found.");
        return;
    }

    let userData = JSON.parse(matches[1].trim());
    console.log(userData.gamekeys.length + " gamekeys found!");
    return userData.gamekeys;
}

async function getGameKeyData(gamekeys) {
    let gameKeyFileExists = await fs
        .access(gameKeyDataFilePath)
        .then(() => true)
        .catch(() => false);
    let gameKeyFileData = gameKeyFileExists ? JSON.parse(await fs.readFile(gameKeyDataFilePath, "utf8")) : {};

    gamekeys = gamekeys.filter((k) => !Object.keys(gameKeyFileData).includes(k));
    console.log("Existing gamekeyFileData loaded. New gamekeys: " + gamekeys.length);
    if (gamekeys.length == 0) return gameKeyFileData;

    // Get detailed info about each gamekey requesting 40 at a time
    var chunkStart = 0,
        chunkEnd = 0;
    do {
        chunkEnd = chunkEnd + 40 > gamekeys.length ? gamekeys.length : chunkEnd + 40;
        console.log("Retrieving Chunk " + chunkStart + "-" + chunkEnd);

        let productListUrl = "https://www.humblebundle.com/api/v1/orders?all_tpkds=true";
        for (let i = chunkStart; i < chunkEnd; i++) {
            productListUrl += "&gamekeys=" + gamekeys[i];
        }

        let response = await humbleFetch(productListUrl, true);
        let data = await response.json();

        Object.entries(data).map(([k, v]) => (gameKeyFileData[k] = v));

        await fs.writeFile(gameKeyDataFilePath, JSON.stringify(gameKeyFileData), "utf8");

        chunkStart += 40;
    } while (chunkEnd < gamekeys.length);

    return gameKeyFileData;
}

async function getChoiceGames(url) {
    let response = await humbleFetch(url);
    let data = await response.text();

    const regex = /<script\s+id="webpack-monthly-product-data"\s+type="application\/json">([\s\S]*?)<\/script>/;
    const matches = data.match(regex);

    if (!matches) console.Error("Could not find data for choice: " + url);

    var monthlyData = JSON.parse(matches[1].trim());
    if (!monthlyData.contentChoiceOptions.canRedeemGames) console.log("Can Redeem Games: False");

    let redeemedGames = findKey(monthlyData, "choices_made") ?? [];

    let rawGamesList = monthlyData.productIsChoiceless
        ? Object.values(monthlyData.contentChoiceOptions.contentChoiceData.game_data)
        : Object.values(findKey(monthlyData, "content_choices")) ?? null;

    if (rawGamesList == null) console.error("Could not find choice games.");

    let gamesList = rawGamesList
        .filter((v) => !redeemedGames.includes(v.display_item_machine_name))
        .map((v) => {
            let hasNested = v.nested_choice_tpkds == undefined;
            let steam_app_id = hasNested ? findKey(v.tpkds, "steam_app_id") : findKey(v.nested_choice_tpkds, "steam_app_id");
            if (steam_app_id == undefined) {
                console.warn("Could not find steam_app_id for title:" + v.title);
                steam_app_id = null;
            }
            return { steam_app_id: steam_app_id, title: v.title };
        });
    return gamesList;
}

function getUndredeemedGames(gamekeyData) {
    //let amountspends = Object.values(gamekeyData).map(g => [g.amount_spent.toFixed(2).padStart(5, '0'), g.created,g.product.human_name])
    //const sortedNumbersDesc = amountspends.sort((a, b) => new Date(b[1]) - new Date(a[1]));
    //console.log('Sorted numbers in descending order:', sortedNumbersDesc);
    let noSteamAppId = [];
    let games = Object.values(gamekeyData).reduce((list, g) => {
        g.tpkd_dict.all_tpks.map((tpk) => {
            if (tpk.key_type == "steam" && !tpk.machine_name.includes("freegame")) {
                if (tpk.redeemed_key_val == null || tpk.redeemed_key_val == undefined) {
                    list.push({ steam_app_id: tpk.steam_app_id, title: tpk.human_name });
                    if (tpk.steam_app_id == null) noSteamAppId.push(tpk.human_name);
                }
            }
        });
        return list;
    }, []);

    return games;
}

async function humbleFetch(url, isJSON = false) {
    let headers = {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "max-age=0",
        "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        cookie: HUMBLE_COOKIE,
        Referer: "https://www.humblebundle.com/home/keys",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    };
    if (isJSON)
        headers = {
            accept: "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9",
            "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest",
            cookie: HUMBLE_COOKIE,
            Referer: "https://www.humblebundle.com/home/keys",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        };

    try {
        const response = await fetch(url, {
            headers: headers,
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data! HTTP error: ${response.status}`);
        }

        return response;
    } catch (error) {
        console.error(`Could not get humble data: ${error}`);
    }
}

function findKey(jsonObj, keyToFind) {
    for (let key in jsonObj) {
        if (key === keyToFind) {
            return jsonObj[key];
        } else if (typeof jsonObj[key] === "object") {
            const result = findKey(jsonObj[key], keyToFind);
            if (result !== undefined) {
                return result;
            }
        }
    }
    return undefined;
}

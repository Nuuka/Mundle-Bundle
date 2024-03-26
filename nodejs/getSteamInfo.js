const axios = require('axios')
const fs = require("fs/promises");
const path = require("path");

const ISAD_API_KEY = ""; // Add your ISAD API Key here

const gameListFilePath = path.join("nodejs/json", "humble_game_list.json");
const finalgameListFilePath = path.join("nodejs/json", "gameDetailedList.json");
const erroredGamesFilePath = path.join("nodejs/json", "erroredGames.json");
const noMCGamesFilePath = path.join("nodejs/json", "noMetaCriticGames.json");


(async () => {
    // humble game list
    // let gameListFile = await fs.access(gameListFilePath).then(() => true).catch(() => false);
    // let gamesList = gameListFile ? JSON.parse(await fs.readFile(gameListFilePath, "utf8")) : {};

    // let gameListFile = await fs.access(erroredGamesFilePath).then(() => true).catch(() => false);
    // let gamesList = gameListFile ? JSON.parse(await fs.readFile(erroredGamesFilePath, "utf8")) : {};
    
    // await processGameList(gamesList.map(g => g.game));

    // let gameListFile = await fs.access(finalgameListFilePath).then(() => true).catch(() => false);
    // let gamesList = gameListFile ? JSON.parse(await fs.readFile(finalgameListFilePath, "utf8")) : {};
    // console.log(gamesList.filter(g => !g.tags).map(g => g.name));
})()

async function processGameList(gamesList) {
    let erroredGames = [];
    var chunkStart = 0, chunkEnd = 0, chunkSize = 50;
    do {
        chunkEnd = chunkEnd + chunkSize > gamesList.length ? gamesList.length : chunkEnd + chunkSize;
        console.log("Processing Chunk " + chunkStart + "-" + chunkEnd);
        let gameDetailedInfoList = [];
        let noMCGames = [];

        for (let i = chunkStart; i < chunkEnd; i++) {
            let game = gamesList[i];
            console.info(`Processing game: ${game.steam_app_id} - ${game.title}`);
            try{
                let steamInfo = await getSteamInfoByID(game.steam_app_id);
                if (steamInfo instanceof Error) {
                    console.log(`Error getting info for game: ${game.steam_app_id} - ${game.title}`);
                    console.error(steamInfo.message)
                    if (steamInfo.message.includes("code 429")) {
                        console.log("Rate limit reached, waiting for 30 seconds before retrying")
                        await timeout(30000); // 30 second delay
                        i -= 1; // retry the same game
                        continue;
                    }
                    erroredGames.push({game, reason: "steamInfo", message: steamInfo.message})
                    continue;
                }

                let gameInfo = {
                    id : game.steam_app_id.toString(),
                    name : steamInfo.name,
                    genres : steamInfo.genres?.map(g => g.description),
                    features: steamInfo.categories?.map(c => c.description),
                    imageUrl: steamInfo.header_image,
                }

                let ISADGameID = await getISADGameID(game.steam_app_id); 
                if (ISADGameID instanceof Error) {
                    console.log(`Error getting ISAD ID for game: ${game.steam_app_id} - ${game.title}`);
                    console.error(ISADGameID.message)
                    erroredGames.push({game, reason: "ISADGameID", message: ISADGameID.message})
                    continue;
                }

                let ISADGameInfo = await getISADGameInfoByID(ISADGameID);
                if (ISADGameInfo instanceof Error) {
                    console.log(`Error getting ISAD Info for game: ${game.steam_app_id} - ${game.title}`);
                    console.error(ISADGameInfo.message);
                    erroredGames.push({ game, reason: "ISADGameInfo", message: ISADGameInfo.message });
                    continue;
                }

                if (ISADGameInfo.reviews.filter(r => r.source == "Steam").length > 0) {
                    let steamReview = ISADGameInfo.reviews.filter(r => r.source == "Steam")[0];
                    gameInfo.score = steamReview.score;
                    gameInfo.userReviews = steamReview.count;
                } else {
                    console.log(`No Steam review data found for game: ${game.steam_app_id} - ${game.title}`);
                }

                if (ISADGameInfo.reviews.filter(r => r.source == "Metascore").length > 0 && ISADGameInfo.reviews.filter(r => r.source == "Metascore")[0].score != null) {
                    let metcriticReview = ISADGameInfo.reviews.filter(r => r.source == "Metascore")[0];
                    gameInfo.metacriticScore = metcriticReview.score;
                }else if (ISADGameInfo.reviews.filter(r => r.source == "OpenCritic").length > 0 && ISADGameInfo.reviews.filter(r => r.source == "OpenCritic")[0].score != null) {
                    let opencriticReview = ISADGameInfo.reviews.filter(r => r.source == "OpenCritic")[0];
                    gameInfo.metacriticScore = opencriticReview.score;
                }else if(ISADGameInfo.reviews.filter(r => r.source == "Metacritic User Score").length > 0) {
                    let metcriticUserReview = ISADGameInfo.reviews.filter(r => r.source == "Metacritic User Score")[0];
                    gameInfo.metacriticScore = metcriticUserReview.score;
                }else{
                    if (ISADGameInfo.type == "game"){
                        console.info(`No Metacritic review data found for game: ${game.steam_app_id} - ${game.title}`);
                        noMCGames.push(game);
                    }
                }

                gameInfo.tags = ISADGameInfo.tags ?? [];
                gameInfo.releaseDate = ISADGameInfo.releaseDate;
                gameInfo.rank = ISADGameInfo.stats?.rank;
                gameInfo.type = ISADGameInfo.type;
                gameDetailedInfoList.push(gameInfo);
            }catch (error) {
                console.log(`Error getting Info for game: ${game.steam_app_id} - ${game.title}`);
                console.log(error)
                erroredGames.push({ game, reason: "error", message: error.message });
            }
        }

        await saveFile(finalgameListFilePath, gameDetailedInfoList);
        await saveFile(noMCGamesFilePath, noMCGames);
        await fs.writeFile(erroredGamesFilePath, JSON.stringify(erroredGames), "utf8");

        chunkStart += chunkSize;
        await timeout(2000); // 3 seconds delay between each chunk
    } while (chunkEnd < gamesList.length);
}

async function saveFile(filePath, data) {
    try {
        let existingData = await fs.readFile(filePath, "utf8");
        let parsedData = JSON.parse(existingData);
        parsedData.push(...data);
        await fs.writeFile(filePath, JSON.stringify(parsedData), "utf8");
        console.log(`File saved successfully: ${filePath}`);
    } catch (error) {
        console.error(`Failed to save file: ${filePath}`);
        throw error;
    }
}
async function getSteamInfoByID(id) {
    try { 
        let info = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${id}`)
        let actualInfo = info.data[id]
        if (!actualInfo.success) {
            throw ('Steam returned success: false')
        }
        return actualInfo.data
    } catch (err) {
        return Error(err)
    }
}

async function getISADGameID(id) {
    try {
        let response = await axios.get(`https://api.isthereanydeal.com/games/lookup/v1?key=${ISAD_API_KEY}&appid=${id}`)
        if (response.status != 200) 
            throw (`ISAD returned: ${response.status} - ${response.statusText} \n INNER: ${response.status_code} - ${response.reason_phrase}`)
        
            let data = response.data
        if (!data.found) 
            throw ('ISAD returned: game not found!')
        return data.game.id
    } catch (err) {
        return Error(err)
    }
}

async function getISADGameInfoByID(id) {
    try {
        let response = await axios.get(`https://api.isthereanydeal.com/games/info/v2?key=${ISAD_API_KEY}&id=${id}`)
        if (response.status != 200) 
            throw (`ISAD returned: ${response.status} - ${response.statusText} \n INNER: ${response.status_code} - ${response.reason_phrase}`)

        return response.data
    } catch (err) {
        return Error(err)
    }
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
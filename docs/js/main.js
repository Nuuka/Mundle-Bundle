let masterGameList = null;
let gameList = null;


function init() {
    $.getJSON("./json/gameDetailedList.json", function(listResult){
        // load the data for all the games
        masterGameList = listResult
            .sort(function(a, b){return b.metacriticScore - a.metacriticScore});;
            initCardsASync(masterGameList);
    });
}

function initCardsASync(cardList) {
    setTimeout(function() {
        let container = d3.select("#game-list");
        container.html("");

        let renderedGames = []
        for (let i = 0; i < cardList.length; i++) {
            let game = cardList[i];
            if (renderedGames.includes(game.id)){
                continue;
            }
            renderedGames.push(game.id);
            renderCardASync(container,game);
        }
    }, 0);
}

function renderCardASync(container,game) {
    setTimeout(function() {
        let cardContainer = container.append("a").attr("class","card").attr("id",game.id)
            .attr("href","https://store.steampowered.com/app/"+ game.id)
            .attr("target","_blank");
        
        // Card Title 
        let cardTitle = cardContainer.append("div").attr("class","card-title");
        cardTitle.append("div").attr("class","card-title-name").html(game.name);
        if (game.metacriticScore != null && game.metacriticScore != ""){
            cardTitle.append("div").attr("class","card-title-mc")
                .html(game.metacriticScore).append("div").attr("class","logo");
        }
        
        
        // Card Inner Container
        let cardInnerContainer = cardContainer.append("div").attr("class","card-inner-container");

        cardInnerContainer.append("img").attr("class","card-image")
            .attr("src",game.imageUrl);
        
        let cardDetails = cardInnerContainer.append("div").attr("class","card-details");
        let cardScore = cardDetails.append("div").attr("class","card-details-score");
        cardScore.append("div").attr("class","logo");
        cardScore.html(cardScore.html() + game.score + "% of " + game.userReviews + " Reviews");
            
        
        let cardDetailsGenres = cardDetails.append("div").attr("class","card-details-genres");
        game.genres.forEach(genre => {
            cardDetailsGenres.append("div").attr("class","tag").html(genre);
        });
        if (game.features.includes("VR Support")){
            cardDetailsGenres.append("div").attr("class","tag").html("VR Support");
        }
    }, 0);
}


function filterCardsASync(cardList) {
    setTimeout(function() {
        for (let i = 0; i < masterGameList.length; i++) {
            if (cardList.some(x => x.id == masterGameList[i].id)){
                $('#'+masterGameList[i].id).show();
            }else{
                $('#'+masterGameList[i].id).hide();
            }
        }
    }, 0);
}

function showAllCardsASync() {
    setTimeout(function() {
        for (let i = 0; i < masterGameList.length; i++) {
            $('#'+masterGameList[i].id).show();
        }
    }, 0);
}
function filterTagToggle(elem){
    var group = document.tagForm.tagGroup;
    var filterTagList = [];
    for (var i=0; i<group.length; i++) {
        if (group[i].checked)
            filterTagList.push(group[i].id)
    }
    if (filterTagList.length > 0){
        if (filterTagList.includes("VR Support")){
            gameList = masterGameList.filter(g => filterTagList.every(f => g.genres.includes(f) || g.features.includes(f)));
        }else{
            gameList = masterGameList.filter(g => filterTagList.every(f =>  g.genres.includes(f)));
        }
        filterCardsASync(gameList);
    }else{
        showAllCardsASync();
    }
}
let masterGameList = null;
let gameList = null;


function init() {
    $.getJSON("./json/gameDetailedList.json", function(listResult){
        // load the data for all the games
        masterGameList = listResult
            .sort(function(a, b){return b.metacriticScore - a.metacriticScore});;
        initCards();
    });
}

function initCards() {
    let container = d3.select("#game-list");
    for (let i = 0; i < masterGameList.length; i++) {
        let game = masterGameList[i];

        let cardContainer = container.append("a").attr("class","card")
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

    }
}
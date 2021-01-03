let masterGameList = null;
let gameList = null;

function init() {
    $.getJSON("./json/gameDetailedList.json", function(listResult){
        // load the data for all the games
        masterGameList = listResult
            .sort(function(a, b){return b.metacriticScore - a.metacriticScore});
            initCards(masterGameList);
    });
}

function initCards(cardList) {
        let container = d3.select("#game-list");
        container.html("");

        let renderedGames = []
        for (let game of cardList) {
            if (renderedGames.includes(game.id)){
                continue;
            }
            renderedGames.push(game.id);
            renderCardASync(container,game);
        }
}

function renderCardASync(container,game) {
    setTimeout(function() {
        let cardContainer = container.append("a").attr("class","card").attr("id",game.id)
            .attr('data-mc',game.metacriticScore ?? 0)
            .attr('data-sc',calculateScore(game.score,game.userReviews))
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


function filterCards(cardList) {
    setTimeout(function() {
        for (let masterGame of masterGameList) {
            if (cardList.includes(masterGame.id)){
                $(`#${masterGame.id}`).show();
            }else{
                $(`#${masterGame.id}`).hide();
            }
          }
    }, 0);
}

function showAllCards() {
    setTimeout(function() {
        for (let masterGame of masterGameList) {
            $(`#${masterGame.id}`).show();
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
            gameList = masterGameList.filter(g => filterTagList.every(f => g.genres.includes(f) || g.features.includes(f))).map(x=>x.id);
        }else{
            gameList = masterGameList.filter(g => filterTagList.every(f =>  g.genres.includes(f))).map(x=>x.id);
        }
        filterCards(gameList);
    }else{
        showAllCards();
    }
}

function sortList(elem){
    d3.select('.button-active').classed('button-active',false);
    d3.select(elem).classed("button-active", true);
    
    // var $cards = $('.card').detach()
    // $cards = $cards.sort((a,b) => $(b).attr(elem.id) - $(a).attr(elem.id));
    // $('#game-list').html($cards);

    var $cards = $('.card');
    $cards = $cards.sort((a,b) => $(b).attr(elem.id) - $(a).attr(elem.id));
    for (let card of $cards){
        $('#game-list').append(card);
    }
}

function calculateScore(score,reviews){
    if (score == null || reviews == null){
        return 0;
    }
    return Math.round((score/100) * reviews);
}
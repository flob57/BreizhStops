const input=document.getElementById("search");

input.addEventListener("input",()=>{

    document.getElementById("results").innerHTML=
    "<p>Recherche : "+input.value+"</p>";

});

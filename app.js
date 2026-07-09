function refreshSearch() {
  const query = normalize(searchInput.value.trim());
  const selectedNetwork = networkFilter.value;
  const selectedCity = cityFilter.value;
  const words = query.split(/\s+/).filter(Boolean);

  updateLinkedFilters(selectedNetwork, selectedCity);

  const matches = stops.filter(stop => {
    if (selectedNetwork && stop.reseau !== selectedNetwork) return false;
    if (selectedCity && stop.commune !== selectedCity) return false;

    if (words.length === 0) return selectedNetwork || selectedCity;

    const haystack = normalize(`${stop.nom || ""} ${stop.commune || ""} ${stop.reseau || ""}`);
    return words.every(word => haystack.includes(word));
  });

  currentResults = matches.slice(0, 100);

  displayResults(currentResults, matches.length);
  displayMarkers(currentResults);
}

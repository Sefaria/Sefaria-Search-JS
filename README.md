# Sefaria Search Javascript Library
With this library, you can query and process query results from the Sefaria search API.

Sefaria is an open-source site which hosts a large online library of Jewish texts and source sheets. See Sefaria's site [here](https://www.sefaria.org) and Sefaria's main repo [here](https://www.github.com/Sefaria/Sefaria-Project)


## Installation

```sh
npm install @sefaria/search
```

## Usage

The library contains two main classes which will be discussed below

### Search

`Search` is the most important class in the library. It allows you to query the Sefaria search API, process results and build datastructures to make it easier to filter results 

You can import the `Search` class using

```js
import { Search } from '@sefaria/search';
```

---

`constructor`

```js
(apiHost, searchIndexText, searchIndexSheet) => null
```

- `apiHost`: the Sefaria server you want to point your API requests to. Usually, this will be `https://www.sefaria.org`

- `searchIndexText`: the index for texts in your Elasticsearch database. Usually, this will be `text`

- `searchIndexSheet`: the index for source sheets in your Elasticsearch database. Usually, this will be `sheet`

---

`execute_query`

```js
({
  query: string,
  type: oneOf("text", "sheet"),
  field: string, // which field do you want to query? usually either "exact", "naive_lemmatizer" or "content"
  exact: boolean, // if query is an exact query
  start: int, // pagination start
  size: int, // page size
  applied_filters: array[string], // list of filters you've applied
  appliedFilterAggTypes: array[string], // list of fields each filter is filtering on. must be same size as `filters` usually fields are either "path", "group" or "tags"
  aggregationsToUpdate: array[string], // list of fields to aggregate on. usually "path", "group" or "tags"
  sort_type: string, // how to sort. either "sort" or "score"  
}) => returns Elasticsearch result list (see here for more details: https://www.elastic.co/guide/en/elasticsearch/reference/6.1/_the_search_api.html)
```

The only required parameters are `query` and `type`. Default values are available for the rest of the fields from `SearchState.metadataByType` (see below)

---

### SearchState

`SearchState` allows you to save many search related properties to keep track of them. For example, `SearchState` saves the current search results, sort settings and applied filters

---

`constructor`

```js
({
  type: oneOf("text", "sheet"),
  appliedFilters: array[string], // list of filters you've applied
  appliedFilterAggTypes: array[string], // list of fields each filter is filtering on. must be same size as `filters` 
  availableFilters: array[FilterNode], // all available filters for current query. FilterNode is a class defined in the module
  filterRegistry: object(filterName -> FilterNode), // convenience object for accessing FilterNodes more quickly 
  filtersValid: boolean, // are `availableFilters` still valid or do they need to be refetched
  field: string, // which field do you want to query? usually either "exact", "naive_lemmatizer" or "content"
  sortType: string, // how to sort. either "sort" or "score"  
  isLoadingTail: boolean, // for infinite load, are we loading next page
  isLoading: boolean, // is API request pending
  results: array[result], // array of result objects for current results that have been loaded
  numResults: int, // number of results in total. not necessarily the same as `results.length`
  currPage: int,  // current page loaded
}) => null
```

only parameter required is `type`

---

`metadataByType`

object with default values for `SearchState` depending on the query type (either `text` or `sheet`)

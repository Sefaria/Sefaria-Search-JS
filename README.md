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

#### Functions

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

---

`

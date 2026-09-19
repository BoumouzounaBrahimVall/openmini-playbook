# Tech News

A personal Hacker News digest that runs as an OpenMini mini-app. It shows the
last seven days as chips, ranks each day's stories for you, and lets you open
any of them in the system browser.

## Where the stories come from

One request per day to the Hacker News Algolia API:

```
GET https://hn.algolia.com/api/v1/search_by_date
    ?tags=story&hitsPerPage=100
    &numericFilters=created_at_i>=<start>,created_at_i<<end>
```

A "day" is a rolling 24-hour window, not a calendar day. `Today` is the 24
hours ending when you opened the app, `Yesterday` the 24 hours before that,
and so on to `6d`. At 8 in the morning a calendar day would hold only unvoted
overnight posts; a rolling window always covers stories that have had time to
collect points. The windows are fixed when the app launches, so stepping
between chips is stable.

The API returns the 100 newest stories of the window, not the best ones. The
ranking below decides what you see first.

## How the ranking works

Every story gets a score:

```
score = log10(points + 2 * comments + 1)     crowd signal
      * (1 + 1.5 * keywordMatches)           personal relevance
      * recencyDecay                         fresher wins ties
```

**Crowd signal.** Points and comments say how much Hacker News cared. Comments
count double because a discussion is a stronger sign of interest than an
upvote. The logarithm compresses the scale: a 900-point launch is worth about
3.2, a 30-point story about 1.7, so one huge story cannot bury everything else.

**Personal relevance.** Each keyword found in the title or the source domain
multiplies the score by 2.5, two keywords by 4. That is enough for a 30-point
story on a topic you follow to beat a 100-point story you do not, and not
enough for a 3-point story to beat anything with a real discussion.

**Recency.** Within its window a story keeps 100 % of its score at the newest
edge and 70 % at the oldest, in a straight line. This only breaks ties in
favour of the fresher story.

The top score becomes the **top story** card. The rest are split into
**For you** (at least one keyword matched) and **Also today**, each sorted by
score. With no keywords, or no matches, the list is flat.

## Keywords

The gear in the header opens the keyword list. Defaults: `typescript`,
`react`, `react native`, `ai`, `llm`, `claude`, `rust`, `security`.

Matching is whole-word and case-insensitive, against the title and the URL's
hostname. `ai` matches "OpenAI ships AI agents" once, and does not match
"said", "chain" or "detail". `rust` matches a link on `blog.rust-lang.org`.
A multi-word keyword such as `react native` matches as a phrase.

Editing the list saves it immediately and fetches the current day again.

## Showing only some topics

Under the day chips, a second row lists `All` and each keyword you follow.
Tap one or more keywords to see only the stories on those topics; the top
story is then the best of them. Tap `All` to see the whole day again. This
filter is local to the session: it costs no request and is not saved.

## Reading and opening a story

Tap a story to unfold it. A text post (Ask HN and the like) shows its body.
A link shows the page's description, or, when the page has none, the first
few hundred characters of its text, plus its social image when it has one.
That preview comes from Jina Reader on demand, one request per tap, never for
a whole day: the service is keyless and allows 20 requests a minute. Images
are resized through the wsrv.nl proxy, which is the one origin the package's
content-security policy lets images load from.

`Open` and `N comments` hand the link to the host app, which opens the system
browser. Links never navigate inside the mini-app: the host draws no chrome,
so a page load would replace the app together with its close button.

## Refreshing

Pull down at the top of the feed to fetch the current day again. Changing the
keyword list also refreshes. Otherwise each day is fetched once per session
and kept in memory, so stepping between chips is instant.

## Coming back after a while

The app remembers when you last opened it. After a day or more away, a line
under the chips says how long you were gone and how many days you never saw;
those chips carry a dot. You still land on `Today`.

## For developers

See [AGENTS.md](./AGENTS.md) for the bridge surface, the manifest and the
commands. The ranking, matching, parsers and storage live in `src/feed/` and
`src/prefs/` and are covered by `src/feed/feed.test.ts`.

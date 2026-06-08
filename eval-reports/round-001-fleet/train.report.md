# Baseline report — round 0

- Domain: `van-ssmuh`
- Split: `train`
- Cases attempted: 18
- Cases scored: 17
- Runtime errors: 1
- Judge enabled: no (deterministic only)

## Composite

| metric | mean | CI95 lower | CI95 upper |
| --- | --- | --- | --- |
| deterministic_prqs | 86.49 | 80.41 | 91.79 |
| partial_full_prqs_lower_bound | 70.95 | 66.69 | 75.19 |

## Per sub-metric

| metric | mean | computed | null |
| --- | --- | --- | --- |
| M1 | 0.765 | 17/17 | 0 |
| M2 | 1.000 | 17/17 | 0 |
| M3 | 0.952 | 17/17 | 0 |
| M4 | 1.000 | 17/17 | 0 |
| M5 | 0.755 | 17/17 | 0 |
| M6 | 0.765 | 17/17 | 0 |
| M7 | 0.941 | 17/17 | 0 |
| M8 | 0.775 | 17/17 | 0 |
| M9 | 1.000 | 17/17 | 0 |
| M10 | 0.549 | 17/17 | 0 |
| M11 | 0.559 | 17/17 | 0 |
| M12 | null | 0/17 | 17 |
| M13 | null | 0/17 | 17 |

## Runtime errors

- `van-ssmuh-train-014` failed at `pre-review-memo-writer`: gh models run exited with status 1.
Error: rate limited: <html>
  <head>
    <meta content="origin" name="referrer">
    <title>Rate limit &middot; GitHub</title>
    <meta name="viewport" content="width=device-width">
    <style type="text/css" media="screen">
      body {
        background-color: #f6f8fa;
        color: rgba(0, 0, 0, 0.5);
        font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol;
        font-size: 14px;
        line-height: 1.5;
      }
      .c { margin: 50px auto; max-width: 600px; text-align: center; padding: 0 24px; }
      a { text-decoration: none; }
      a:hover { text-decoration: underline; }
      h1 { color: #24292e; line-height: 60px; font-size: 48px; font-weight: 300; margin: 0px; }
      p { margin: 20px 0 40px; }
      #s { margin-top: 35px; }
      #s a {
        color: #666666;
        font-weight: 200;
        font-size: 14px;
        margin: 0 10px;
      }
    </style>
  </head>
  <body>
    <div class="c">
      <h1>Whoa there!</h1>
      <p>You have triggered an abuse detection mechanism.<br><br>
        Please wait a few minutes before you try again;<br>
        in some cases this may take up to an hour.
      </p>
      <div id="s">
        <a href="https://support.github.com">Contact Support</a> &mdash;
        <a href="https://githubstatus.com">GitHub Status</a> &mdash;
        <a href="https://twitter.com/githubstatus">@githubstatus</a>
      </div>
    </div>
  </body>
</html> (retry after 1m0s)
Usage:
  gh models run [model] [prompt] [flags]

Examples:
gh models run openai/gpt-4o-mini "how many types of hyena are there?"
gh models run --org my-org openai/gpt-4o-mini "how many types of hyena are there?"
gh models run --file prompt.yml --var name=Alice --var topic="machine learning"


Flags:
      --file string            Path to a .prompt.yml file.
  -h, --help                   help for run
      --max-tokens string      Limit the maximum tokens for the model response.
      --org string             Organization to attribute usage to (omitting will attribute usage to the current actor
      --system-prompt string   Prompt the system.
      --temperature string     Controls randomness in the response, use lower to be more deterministic.
      --top-p string           Controls text diversity by selecting the most probable words until a set probability is reached.
      --var stringArray        Template variables for prompt files (can be used multiple times: --var name=value)

## Missingness (non-standard empty-set branches)

- `M6` `vacuous_one_empty_both` 2
- `M6` `zero_predicted_nonempty_gold_empty` 2
- `M8` `vacuous_one_empty_both` 2
- `M8` `zero_predicted_nonempty_gold_empty` 2
- `M10` `vacuous_one_empty_both` 5
- `M10` `zero_gold_nonempty_predicted_empty` 2
- `M11` `vacuous_one_empty_both` 5
- `M11` `zero_predicted_nonempty_gold_empty` 2
- `M12` `not_applicable` 17
- `M13` `not_applicable` 17

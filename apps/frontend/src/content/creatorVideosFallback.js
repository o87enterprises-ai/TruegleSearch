// Build-time snapshot of each creator's latest uploads, keyed by channelId.
// Fallback for when the live API returns no videos (YouTube throttles RSS from
// datacenter IPs). Refresh: node scripts/seed-creator-videos.mjs. Last: 2026-07-24.
export const CREATOR_VIDEOS_FALLBACK = {
  "UCZw8SuiTYSvPKmnMe8LDtpA": [],
  "UCQT9VG5hpLKp8of41fvDdtw": [],
  "UCdcfgAjgP1OvNIFTWkbPV8Q": [],
  "UC-ocTFTWBWI0b-wjYoCKuPg": [
    {
      "videoId": "jkUpdHuI2ho",
      "title": "NEW! Creepy And Strange Tik Toks That Will Make You Question Reality!",
      "published": "2026-07-20T19:28:32+00:00",
      "thumbnail": "https://i3.ytimg.com/vi/jkUpdHuI2ho/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=jkUpdHuI2ho"
    },
    {
      "videoId": "6Mx0S0hl-sM",
      "title": "TIK TOKS SO CREEPY THEY WILL LEAVE YOU SPEECHLESS!! | NEW |",
      "published": "2026-07-17T22:13:41+00:00",
      "thumbnail": "https://i3.ytimg.com/vi/6Mx0S0hl-sM/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=6Mx0S0hl-sM"
    },
    {
      "videoId": "zSXu1DMVek0",
      "title": "CREEPY AND STRANGE TIK TOKS THAT WILL MAKE YOU QUESTION REALITY!",
      "published": "2026-07-15T17:01:16+00:00",
      "thumbnail": "https://i3.ytimg.com/vi/zSXu1DMVek0/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=zSXu1DMVek0"
    },
    {
      "videoId": "oOR3IAHdXRA",
      "title": "TIK TOKS SO CREEPY THEY WILL LEAVE YOU SPEECHLESS!! | Recap |",
      "published": "2026-07-14T17:56:49+00:00",
      "thumbnail": "https://i4.ytimg.com/vi/oOR3IAHdXRA/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=oOR3IAHdXRA"
    },
    {
      "videoId": "mT1PY2ZvBAA",
      "title": "THESE VIRAL TIKTOKS ARE GENUINELY DISTURBING |Best of May|",
      "published": "2026-06-25T23:09:38+00:00",
      "thumbnail": "https://i2.ytimg.com/vi/mT1PY2ZvBAA/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=mT1PY2ZvBAA"
    },
    {
      "videoId": "98H4TPFaaio",
      "title": "REALITY IS MOT WHAT YOU THINK…THESE ARE THE MOST CRINGE TIKTOKS ON THE INTERNET! BEST OF APRIL",
      "published": "2026-06-24T14:31:42+00:00",
      "thumbnail": "https://i2.ytimg.com/vi/98H4TPFaaio/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=98H4TPFaaio"
    }
  ],
  "UCmxXPdAg3iQaepCBO2JHjVA": [],
  "UCCVP1ck3ucAgLJFJNlPWamw": [
    {
      "videoId": "Gj3fUojMpzI",
      "title": "Austria and the Old World",
      "published": "2026-06-17T06:00:32+00:00",
      "thumbnail": "https://i4.ytimg.com/vi/Gj3fUojMpzI/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=Gj3fUojMpzI"
    },
    {
      "videoId": "tDPdn3yU1fo",
      "title": "i love the old world",
      "published": "2026-06-13T16:30:22+00:00",
      "thumbnail": "https://i1.ytimg.com/vi/tDPdn3yU1fo/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=tDPdn3yU1fo"
    },
    {
      "videoId": "JsyXcRbRx5E",
      "title": "#Where are We",
      "published": "2023-02-09T17:45:24+00:00",
      "thumbnail": "https://i3.ytimg.com/vi/JsyXcRbRx5E/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=JsyXcRbRx5E"
    },
    {
      "videoId": "yuaAITERpDA",
      "title": "The Other Video (Sunnyside Utah) Coke Kilns- Part Two",
      "published": "2022-07-10T07:00:13+00:00",
      "thumbnail": "https://i2.ytimg.com/vi/yuaAITERpDA/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=yuaAITERpDA"
    },
    {
      "videoId": "Mh9QKt2b1oQ",
      "title": "Dreams Edited",
      "published": "2022-01-27T08:22:12+00:00",
      "thumbnail": "https://i2.ytimg.com/vi/Mh9QKt2b1oQ/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=Mh9QKt2b1oQ"
    },
    {
      "videoId": "7vaV6fsx8Kw",
      "title": "Know Your Rights (Full Segment)",
      "published": "2021-09-11T07:00:02+00:00",
      "thumbnail": "https://i4.ytimg.com/vi/7vaV6fsx8Kw/hqdefault.jpg",
      "url": "https://www.youtube.com/watch?v=7vaV6fsx8Kw"
    }
  ],
  "UCQVBGSq7vdLanRbowiu163w": [],
  "UC0UpxtDnri_fa5fB_PoAYhw": [],
  "UCB9LqQNtyPPdW1prv0h8_5Q": [],
  "UC8DA4o0SyaGfyVaBLbF5EXg": []
};

export const fallbackVideos = (channelId) => CREATOR_VIDEOS_FALLBACK[channelId] || [];

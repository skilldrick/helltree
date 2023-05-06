import bsky from '@atproto/api';
const { BskyAgent } = bsky;
import * as dotenv from 'dotenv';
import process from 'node:process';
dotenv.config();

// takes an at:// uri and returns a web url, or returns https:// url unchanged
const getWebUrl = async (uri?: string): Promise<string> => {
  if (!uri) return "";
  let split = uri.split("/");

  if (split[0] === "at:") {
    let profile = await agent.getProfile({actor: split[2]});
    return `https://staging.bsky.app/profile/${profile.data.handle}/post/${split[4]}`;
  } else if (split[0] === "https:") {
    return uri;
  } else {
    return `Invalid uri: ${uri}`;
  }
}

// takes an https:// web url and returns a uri
const getUri = async (webUrl: string): Promise<string> => {
  let split = webUrl.split("/");

  if (split[0] === "https:") {
    let user = split[4];
    let slug = split[6];
    let res = await agent.resolveHandle({ handle: user });
    let did = res.data.did;
    return `at://${did}/app.bsky.feed.post/${slug}`;
  } else {
    throw new Error(`Invalid url ${webUrl}`);
  }
}

const getPost = async (user: string, slug: string): Promise<{
  uri: string;
  cid: string;
  value: { text: string, reply?: { parent: { uri: string }, root: { uri: string }} }
}> => {
  return agent.getPost({repo: user, rkey: slug}); 
};

// convert uris to bsky web urls and only return limited data
const getPostFriendly = async (user: string, slug: string): Promise<{
  webUrl: string;
  text: string,
  parentUrl: string,
  rootUri?: string,
  rootUrl: string
}> => {
  let post = await getPost(user, slug);
  let webUrl = await getWebUrl(post.uri);
  let parentUrl = await getWebUrl(post.value.reply?.parent.uri);
  let rootUrl = await getWebUrl(post.value.reply?.root?.uri);

  return { webUrl, text: post.value.text, parentUrl, rootUri: post.value.reply?.root?.uri, rootUrl };
}

const getPostFromUri = async (uri: string): Promise<{
  webUrl: string;
  text: string,
  parentUrl: string,
  rootUrl: string
}> => {
  let split = uri.split("/");
  if (split[0] === "at:") {
    return getPostFriendly(split[2], split[4]); 
  } else if (split[0] === "https:") {
    return getPostFriendly(split[4], split[6]); 
  } else {
    throw new Error(`Invalid uri: ${uri}`);
  }
};


const logPost = async (uri: string) => {
  try {
    let res = await getPostFromUri(uri);
    let webUrl = await getWebUrl(uri);
    console.log(res);
  } catch (e) {
    console.log(`uri: ${uri} error: ${e}`);
  }
}

const agent = new BskyAgent({
  service: 'https://bsky.social',
});

let me = await agent.login({
  identifier: process.env.BSKY_USERNAME!,
  password: process.env.BSKY_PASSWORD!,
});

const recurseThread = (t: bsky.AppBskyFeedDefs.ThreadViewPost, indent: number) => {
  console.log(Array(indent).join(" ") + t.post.author.handle + ": " + (t.post.record as any).text);
  //console.log((t.post.record as any).reply.root.uri);

  if ((t as any).replies.length === 0) {
    console.log(Array(indent).join(" ") + "LEAF");
  }
  for (let r of (t as any).replies ?? []) {
    if (bsky.AppBskyFeedDefs.isThreadViewPost(r)) {
      recurseThread(r, indent + 1);
    } else {
      console.log(Array(indent).join(" ") + "Not found");
    }
  }
}

// just logs leaf threads
const recurseThread2 = async (t: bsky.AppBskyFeedDefs.ThreadViewPost, indent: number) => {
  //console.log((t.post.record as any).reply.root.uri);

  if ((t as any).replies.length === 0) {
    console.log(indent + " " + (t.post.record as any).text.replace("\n", "\\n") + " " + url);
  }
  for (let r of (t as any).replies ?? []) {
    if (bsky.AppBskyFeedDefs.isThreadViewPost(r)) {
      recurseThread2(r, indent + 1);
    }
  }
}


let uriOrUrl = process.argv[2];
let uri;
let url;

if (uriOrUrl.startsWith("at")) {
  uri = uriOrUrl;
  url = await getWebUrl(uri);
} else {
  uri = await getUri(uriOrUrl);
  url = uriOrUrl;
}

console.log(url);

let thread = await agent.getPostThread({
  //uri: "at://did:plc:vs6q5esladn7xrr4j62sbctz/app.bsky.feed.post/3jux4davwa42j",
  uri: uri,
  depth: 200 
});

let t = thread.data.thread;

if (bsky.AppBskyFeedDefs.isThreadViewPost(t)) {
  recurseThread2(t, 0);
}
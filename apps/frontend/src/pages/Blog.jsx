import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';
import { BLOG_POSTS } from '../content/blogPosts.jsx';

/** Blog index — lists every article. Prerendered for crawlers (see scripts/). */
const Blog = () => (
  <LegalPage title="Truegle Blog">
    <p className="text-gray-400">
      Notes on private search, filter bubbles, and seeing the web without a
      filter — from the team building Truegle.
    </p>

    <div className="space-y-8 mt-2">
      {BLOG_POSTS.map((post) => (
        <article
          key={post.slug}
          className="border-b border-gray-800 pb-6 last:border-b-0"
        >
          <h2 className="text-xl font-semibold">
            <Link
              to={`/blog/${post.slug}`}
              className="text-white hover:text-blue-300"
            >
              {post.title}
            </Link>
          </h2>
          <p className="mt-1 text-xs text-gray-500 font-mono">
            {post.date} · {post.readingTime}
          </p>
          <p className="mt-2 text-gray-400">{post.description}</p>
          <Link
            to={`/blog/${post.slug}`}
            className="inline-block mt-2 text-sm text-blue-400 hover:text-blue-300"
          >
            Read more →
          </Link>
        </article>
      ))}
    </div>
  </LegalPage>
);

export default Blog;

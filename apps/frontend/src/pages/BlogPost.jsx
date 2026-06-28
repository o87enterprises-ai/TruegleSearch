import React from 'react';
import { useParams, Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';
import { getPostBySlug } from '../content/blogPosts.jsx';

/**
 * Single blog article. Accepts an optional `slug` prop so the build-time
 * prerenderer can render a specific post without route matching; the live app
 * falls back to the :slug route param.
 */
const BlogPost = ({ slug: slugProp }) => {
  const params = useParams();
  const slug = slugProp || params.slug;
  const post = getPostBySlug(slug);

  if (!post) {
    return (
      <LegalPage title="Article not found">
        <p>
          We couldn't find that article. Browse all posts on the{' '}
          <Link to="/blog" className="text-blue-400 hover:text-blue-300">
            Truegle Blog
          </Link>
          .
        </p>
      </LegalPage>
    );
  }

  const postUrl = `https://truegle.info/blog/${post.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': postUrl,
    url: postUrl,
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', '@id': 'https://truegle.info/#organization', name: 'Truegle' },
    publisher: { '@id': 'https://truegle.info/#organization' },
    image: {
      '@type': 'ImageObject',
      url: 'https://truegle.info/og-image.png',
      width: 1200,
      height: 630,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
    isPartOf: {
      '@type': 'Blog',
      '@id': 'https://truegle.info/blog',
      name: 'Truegle Blog',
      url: 'https://truegle.info/blog',
    },
  };

  return (
    <LegalPage title={post.title} lastUpdated={post.date}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="-mt-2 text-xs text-gray-500 font-mono">{post.readingTime}</p>
      {post.body}
      <div className="pt-6 mt-6 border-t border-gray-800">
        <Link to="/blog" className="text-sm text-blue-400 hover:text-blue-300">
          ← All articles
        </Link>
      </div>
    </LegalPage>
  );
};

export default BlogPost;

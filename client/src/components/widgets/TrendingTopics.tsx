import { Link } from 'wouter';

interface TrendingTopic {
  tag: string;
  postCount: number;
}

const trendingTopics: TrendingTopic[] = [
  { tag: 'Decentralization', postCount: 328 },
  { tag: 'Cryptography', postCount: 245 },
  { tag: 'Privacy', postCount: 187 },
  { tag: 'NostrProtocol', postCount: 142 }
];

export default function TrendingTopics() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Trending Topics</h3>
        <div className="space-y-3">
          {trendingTopics.map((topic, index) => (
            <div key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-2 last:pb-0">
              <Link href={`/tag/${topic.tag.toLowerCase()}`} className="block">
                <p className="text-sm font-medium text-primary dark:text-primary-light">
                  #{topic.tag}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {topic.postCount} recent posts
                </p>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

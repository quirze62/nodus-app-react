import React, { useState } from 'react';
import { Search, Filter, X, TrendingUp, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

export type FilterMode = 'all' | 'followers' | 'follows' | 'trending';

export interface FeedFilters {
  searchTerm: string;
  showOnlyVerified: boolean;
  showOnlyFollowed: boolean;
  showOnlyFollowing: boolean;
  showTrending: boolean;
  includeReposts: boolean;
  includeMentions: boolean;
  tags: string[];
  filterMode: FilterMode;
}

export const DEFAULT_FILTERS: FeedFilters = {
  searchTerm: '',
  showOnlyVerified: true,
  showOnlyFollowed: false,
  showOnlyFollowing: false,
  showTrending: false,
  includeReposts: true,
  includeMentions: true,
  tags: [],
  filterMode: 'all'
};

interface FeedFiltersProps {
  filters: FeedFilters;
  onFiltersChange: (filters: FeedFilters) => void;
}

export function FeedFiltersBar({ filters, onFiltersChange }: FeedFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.searchTerm);
  const [activeTags, setActiveTags] = useState<string[]>(filters.tags);
  const [currentTag, setCurrentTag] = useState('');

  // Update search filter with debouncing
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    
    // Update parent component after a short delay to prevent too many updates
    const timeoutId = setTimeout(() => {
      onFiltersChange({
        ...filters,
        searchTerm: value
      });
    }, 300);
    
    return () => clearTimeout(timeoutId);
  };

  // Toggle a specific boolean filter
  const toggleFilter = (filterName: keyof FeedFilters) => {
    if (typeof filters[filterName] === 'boolean') {
      onFiltersChange({
        ...filters,
        [filterName]: !filters[filterName as keyof FeedFilters]
      });
    }
  };

  // Add a tag filter
  const addTagFilter = () => {
    if (currentTag && !activeTags.includes(currentTag)) {
      const newTags = [...activeTags, currentTag];
      setActiveTags(newTags);
      setCurrentTag('');
      onFiltersChange({
        ...filters,
        tags: newTags
      });
    }
  };

  // Remove a tag filter
  const removeTagFilter = (tag: string) => {
    const newTags = activeTags.filter(t => t !== tag);
    setActiveTags(newTags);
    onFiltersChange({
      ...filters,
      tags: newTags
    });
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchValue('');
    setActiveTags([]);
    setCurrentTag('');
    onFiltersChange(DEFAULT_FILTERS);
  };

  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-3 border-b border-gray-200 dark:border-gray-800 mb-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Search posts"
            className="pl-9"
            value={searchValue}
            onChange={handleSearchChange}
          />
        </div>
        
        {/* Filter Mode Selector Dropdown */}
        <select 
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm font-medium"
          value={filters.filterMode}
          onChange={(e) => {
            const newMode = e.target.value as FilterMode;
            onFiltersChange({
              ...filters,
              filterMode: newMode,
              // Also update the checkboxes to match the selected mode
              showOnlyFollowed: newMode === 'followers',
              showOnlyFollowing: newMode === 'follows',
              showTrending: newMode === 'trending'
            });
          }}
        >
          <option value="all">All Posts</option>
          <option value="followers">Followers</option>
          <option value="follows">Following</option>
          <option value="trending">Trending</option>
        </select>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/50">
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <h3 className="font-medium text-blue-600 dark:text-blue-400">Filter Options</h3>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium mb-2">Feed Filter Mode</h4>
                <div className="ml-2 space-y-1">
                  <select
                    className="w-full px-2 py-1 border rounded-md"
                    value={filters.filterMode}
                    onChange={(e) => {
                      const newMode = e.target.value as FilterMode;
                      onFiltersChange({
                        ...filters,
                        filterMode: newMode,
                        // Also update the checkboxes to match the selected mode
                        showOnlyFollowed: newMode === 'followers',
                        showOnlyFollowing: newMode === 'follows',
                        showTrending: newMode === 'trending'
                      });
                    }}
                  >
                    <option value="all">All Posts</option>
                    <option value="followers">Followers</option>
                    <option value="follows">Following</option>
                    <option value="trending">Trending</option>
                  </select>
                </div>
                
                <h4 className="text-sm font-medium mb-2 mt-4">View Mode</h4>
                <div className="ml-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="followed" 
                      checked={filters.showOnlyFollowed}
                      onCheckedChange={() => {
                        // Also update the filter mode if this is checked
                        const showOnlyFollowed = !filters.showOnlyFollowed;
                        onFiltersChange({
                          ...filters,
                          showOnlyFollowed,
                          filterMode: showOnlyFollowed ? 'followers' : filters.filterMode === 'followers' ? 'all' : filters.filterMode
                        });
                      }}
                    />
                    <Label htmlFor="followed" className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-blue-500" /> 
                      Show posts from my followers
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="following" 
                      checked={filters.showOnlyFollowing}
                      onCheckedChange={() => {
                        // Also update the filter mode if this is checked
                        const showOnlyFollowing = !filters.showOnlyFollowing;
                        onFiltersChange({
                          ...filters,
                          showOnlyFollowing,
                          filterMode: showOnlyFollowing ? 'follows' : filters.filterMode === 'follows' ? 'all' : filters.filterMode
                        });
                      }}
                    />
                    <Label htmlFor="following" className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-500" />
                      Show posts from accounts I follow
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="trending" 
                      checked={filters.showTrending}
                      onCheckedChange={() => {
                        // Also update the filter mode if this is checked
                        const showTrending = !filters.showTrending;
                        onFiltersChange({
                          ...filters,
                          showTrending,
                          filterMode: showTrending ? 'trending' : filters.filterMode === 'trending' ? 'all' : filters.filterMode
                        });
                      }}
                    />
                    <Label htmlFor="trending" className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                      Show trending posts
                    </Label>
                  </div>
                </div>
                
                <h4 className="text-sm font-medium mt-4 mb-2">Additional Filters</h4>
                <div className="ml-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="verified" 
                      checked={filters.showOnlyVerified}
                      onCheckedChange={() => toggleFilter('showOnlyVerified')}
                    />
                    <Label htmlFor="verified">Show only verified users</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="reposts" 
                      checked={filters.includeReposts}
                      onCheckedChange={() => toggleFilter('includeReposts')}
                    />
                    <Label htmlFor="reposts">Include reposts</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="mentions" 
                      checked={filters.includeMentions}
                      onCheckedChange={() => toggleFilter('includeMentions')}
                    />
                    <Label htmlFor="mentions">Include mentions</Label>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tag-filter">Filter by tag</Label>
                <div className="flex gap-2">
                  <Input
                    id="tag-filter"
                    placeholder="Enter tag"
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTagFilter();
                      }
                    }}
                  />
                  <Button onClick={addTagFilter} size="sm">Add</Button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {activeTags.map(tag => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    #{tag}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeTagFilter(tag)}
                    />
                  </Badge>
                ))}
              </div>
              
              <Button onClick={resetFilters} variant="ghost" size="sm" className="w-full">
                Reset Filters
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      {/* Active filters display */}
      {(searchValue || 
        activeTags.length > 0 || 
        !filters.includeReposts || 
        !filters.includeMentions || 
        filters.showOnlyFollowed || 
        filters.showOnlyFollowing || 
        filters.showTrending) && (
        <div className="flex flex-wrap gap-2">
          {searchValue && (
            <Badge variant="outline" className="flex items-center gap-1">
              Search: {searchValue}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => {
                  setSearchValue('');
                  onFiltersChange({...filters, searchTerm: ''});
                }}
              />
            </Badge>
          )}
          
          {filters.showOnlyFollowed && (
            <Badge variant="outline" className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900">
              <Users className="h-3 w-3 text-blue-500" />
              From My Followers
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleFilter('showOnlyFollowed')}
              />
            </Badge>
          )}
          
          {filters.showOnlyFollowing && (
            <Badge variant="outline" className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900">
              <Users className="h-3 w-3 text-green-500" />
              From Accounts I Follow
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleFilter('showOnlyFollowing')}
              />
            </Badge>
          )}
          
          {filters.showTrending && (
            <Badge variant="outline" className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900">
              <TrendingUp className="h-3 w-3 text-orange-500" />
              Trending Posts
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleFilter('showTrending')}
              />
            </Badge>
          )}
          
          {!filters.includeReposts && (
            <Badge variant="outline" className="flex items-center gap-1">
              No Reposts
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleFilter('includeReposts')}
              />
            </Badge>
          )}
          
          {!filters.includeMentions && (
            <Badge variant="outline" className="flex items-center gap-1">
              No Mentions
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleFilter('includeMentions')}
              />
            </Badge>
          )}
          
          {activeTags.map(tag => (
            <Badge key={tag} variant="outline" className="flex items-center gap-1">
              #{tag}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => removeTagFilter(tag)}
              />
            </Badge>
          ))}
          
          {(searchValue || 
            activeTags.length > 0 || 
            !filters.includeReposts || 
            !filters.includeMentions || 
            filters.showOnlyFollowed || 
            filters.showOnlyFollowing || 
            filters.showTrending) && (
            <Badge 
              variant="outline" 
              className="flex items-center gap-1 cursor-pointer"
              onClick={resetFilters}
            >
              Clear All
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
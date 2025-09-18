import axios from "axios";
import { config } from "../config/index.js";
const PARTNERS_API_URL = "https://portals-market.com";
const API_KEY = config.PARTNERS_API_KEY;
export interface NFTAttribute {
  type: string;
  value: string;
  rarity_per_mille: number;
}
export interface NFTMetadata {
  id: string;
  name: string;
  collection_id: string;
  external_collection_number: number;
  photo_url: string;
  animation_url?: string;
  has_animation: boolean;
  price?: string;
  floor_price?: string;
  status: "listed" | "unlisted" | "withdrawn" | "auction" | "giveaway_locked" | "bundle";
  attributes: NFTAttribute[];
  is_owned: boolean;
  listed_at?: string;
  unlocks_at?: string;
  tg_id?: string;
  emoji_id?: string;
}
export interface MarketAction {
  type: "sell" | "buy" | "offer" | "listing" | "price_update" | "delist" | "transfer" | "cancel" | "reject";
  created_at: string;
  amount?: string;
  nft: {
    id: string;
    name: string;
    photo_url: string;
    collection_id: string;
    external_collection_number: number;
    is_owned: boolean;
    floor_price?: string;
    price?: string;
  };
}
export interface LiveDrop {
  id: string;
  user: {
    username: string;
    avatar: string;
  };
  item: {
    id: string;
    name: string;
    rarity: string;
    price: number;
    imageUrl: string;
  };
  case: {
    id: string;
    name: string;
    price: number;
    imageUrl: string;
    isLocked: boolean;
    items: unknown[];
  };
  timestamp: string;
}
class PartnersApiService {
  private apiKey: string = API_KEY;
  private getHeaders() {
    return {
      "Authorization": `partners ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }
  async getMarketActions(params: {
    action_types?: ("sell" | "buy" | "offer" | "listing" | "price_update" | "delist" | "transfer" | "cancel" | "reject")[];
    collection_id?: string;
    filter_by_collections?: string[];
    filter_by_models?: string[];
    min_price?: string;
    max_price?: string;
    status?: "listed" | "unlisted";
    sort_by?: "listed_at desc" | "price asc" | "price desc";
    limit?: number;
    offset?: number;
  } = {}): Promise<{ actions: MarketAction[] }> {
    try {
      const response = await axios.get(
        `${PARTNERS_API_URL}/partners/market/actions/`,
        {
          params: {
            limit: 20,
            ...params,
          },
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching market actions:", error);
      return { actions: [] };
    }
  }
  convertMarketActionToLiveDrop(action: MarketAction): LiveDrop {
    return {
      id: action.nft.id,
      timestamp: action.created_at,
      user: {
        username: `User${action.nft.id.slice(-4)}`,
        avatar: '👤',
      },
      case: {
        id: action.nft.collection_id,
        name: action.nft.collection_id,
        price: action.nft.price ? parseFloat(action.nft.price) : 0,
        imageUrl: action.nft.photo_url,
        isLocked: false,
        items: [],
      },
      item: {
        id: action.nft.id,
        name: action.nft.name,
        imageUrl: action.nft.photo_url,
        rarity: action.nft.floor_price ? 'rare' : 'common',
        price: action.amount ? parseFloat(action.amount) : 0,
      },
    };
  }
  async getLiveDrops(): Promise<LiveDrop[]> {
    try {
      const marketData = await this.getMarketActions({
        action_types: ['buy', 'sell'],
        limit: 10,
        sort_by: 'listed_at desc'
      });
      return marketData.actions.map(action => this.convertMarketActionToLiveDrop(action));
    } catch (error) {
      console.error("Error fetching live drops:", error);
      return [];
    }
  }
  async searchNfts(params: {
    filter_by_collections?: string[];
    filter_by_models?: string[];
    limit?: number;
    offset?: number;
    status?: "listed" | "unlisted";
    sort_by?: string;
    with_attributes?: boolean;
  } = {}): Promise<{ results: NFTMetadata[] }> {
    try {
      const response = await axios.get(
        `${PARTNERS_API_URL}/partners/nfts/search`,
        {
          params: {
            limit: 20,
            ...params,
          },
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error searching NFTs:", error);
      return { results: [] };
    }
  }
  async getMarketConfig(): Promise<{ commission: number; min_price: number; max_price: number }> {
    try {
      const response = await axios.get(
        `${PARTNERS_API_URL}/partners/market/config`,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching market config:", error);
      return { commission: 5, min_price: 0.01, max_price: 10000 };
    }
  }
  async getCollectionsList(): Promise<{ collections: Array<{ id: string; name: string; floor_price?: string }> }> {
    try {
      const response = await axios.get(
        `${PARTNERS_API_URL}/partners/collections/floors`,
        {
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );
      const collections = response.data.floors?.map((floor: any) => ({
        id: floor.collection_id,
        name: floor.collection_name || floor.collection_id,
        floor_price: floor.floor_price
      })) || [];
      return { collections };
    } catch (error) {
      console.error("Error fetching collections:", error);
      return { collections: [] };
    }
  }
  async buyNfts(nftIds: string[]): Promise<{ 
    success: boolean; 
    purchased: string[]; 
    failed: Array<{ id: string; reason: string }> 
  }> {
    try {
      const response = await axios.post(
        `${PARTNERS_API_URL}/partners/nfts`,
        {
          nft_ids: nftIds
        },
        {
          headers: this.getHeaders(),
          timeout: 30000,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error buying NFTs:", error);
      return { success: false, purchased: [], failed: nftIds.map(id => ({ id, reason: "API Error" })) };
    }
  }
}
export const partnersApi = new PartnersApiService();
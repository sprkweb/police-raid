import type { NetworkService } from '../types/network';
import { MeteredNetworkService } from './MeteredNetworkService';

/** Wire the active NetworkService implementation here when swapping transports. */
export function createNetworkService(): NetworkService {
  return new MeteredNetworkService();
}

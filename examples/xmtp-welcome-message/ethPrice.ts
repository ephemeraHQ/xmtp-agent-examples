/**
 * Simple ETH price fetcher using CoinGecko API
 */
export class EthPriceService {
  private static readonly COINGECKO_API = "https://api.coingecko.com/api/v3";

  /**
   * Fetch current ETH price in USD
   */
  static async getCurrentPrice(): Promise<{
    price: number;
    change24h: number;
  }> {
    try {
      const response = await fetch(
        `${this.COINGECKO_API}/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as {
        ethereum: {
          usd: number;
          usd_24h_change: number;
        };
      };

      return {
        price: data.ethereum.usd,
        change24h: data.ethereum.usd_24h_change,
      };
    } catch (error: unknown) {
      console.error("Error fetching ETH price:", error);
      throw new Error(
        `Failed to fetch ETH price: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Format price with proper formatting
   */
  static formatPrice(price: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }

  /**
   * Format percentage change with color indicators
   */
  static formatPriceChange(change: number): string {
    const isPositive = change >= 0;
    const formatted = Math.abs(change).toFixed(2);
    const emoji = isPositive ? "📈" : "📉";
    const sign = isPositive ? "+" : "-";

    return `${emoji} ${sign}${formatted}%`;
  }
}

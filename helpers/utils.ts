export const logAgentDetails = (address: string, env: string) => {
  const createLine = (length: number, char = "═"): string =>
    char.repeat(length - 2);
  const centerText = (text: string, width: number): string => {
    const padding = Math.max(0, width - text.length);
    const leftPadding = Math.floor(padding / 2);
    return " ".repeat(leftPadding) + text + " ".repeat(padding - leftPadding);
  };

  console.log(`
    ██╗  ██╗███╗   ███╗████████╗██████╗ 
    ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗
     ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝
     ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝ 
    ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║     
    ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝     
  `);

  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  const maxLength = Math.max(url.length + 12, address.length + 15, 30);

  const box = [
    `╔${createLine(maxLength)}╗`,
    `║   ${centerText("Agent Details", maxLength - 6)} ║`,
    `╟${createLine(maxLength, "─")}╢`,
    `║ 📍 Address: ${address}${" ".repeat(maxLength - address.length - 15)}║`,
    `║ 🔗 URL: ${url}${" ".repeat(maxLength - url.length - 11)}║`,
    `╚${createLine(maxLength)}╝`,
  ].join("\n");

  console.log(box);
};

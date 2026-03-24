// Minimal ABIs for contract interactions

export const ESCROW_ABI = [
  // List NFT
  'function list(address nftContract, uint256 tokenId, uint256 price, uint256 paymentChainId) external',
  // List ERC-20
  'function listToken(address tokenContract, uint256 amount, uint256 price, uint256 paymentChainId) external',
  // Claim (buyer calls after ZK proof)
  'function claim(uint256 listingId, address buyer, bytes calldata merkleProof, bytes32 nullifier) external',
  // Cancel listing (seller)
  'function cancelListing(uint256 listingId) external',
  // Read
  'function listings(uint256) view returns (address seller, address tokenContract, uint256 tokenId, uint256 amount, uint256 price, uint8 status, uint8 assetType, address buyer)',
  'function listingCount() view returns (uint256)',
  'function withdrawalsRoot() view returns (bytes32)',
  'function platformFeeBps() view returns (uint256)',
  // Events
  'event NftListed(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId, uint256 price, uint256 paymentChainId)',
  'event TokenListed(uint256 indexed listingId, address indexed seller, address tokenContract, uint256 amount, uint256 price, uint256 paymentChainId)',
  'event NftClaimed(uint256 indexed listingId, address indexed buyer)',
  'event ListingCancelled(uint256 indexed listingId)',
]

export const VAULT_ABI = [
  'function depositNative(uint16 assetId) external payable',
  'function deposit(uint16 assetId, uint256 amount) external',
  'function withdraw(uint16 assetId, uint256 amount, bytes32[] calldata merkleProof) external',
  'function balanceOf(address account, uint16 assetId) view returns (uint256)',
]

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
]

export const ERC721_ABI = [
  'function approve(address to, uint256 tokenId) external',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function setApprovalForAll(address operator, bool approved) external',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
]

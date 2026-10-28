// The folder every sandbox works in; the only writable place besides /tmp and the home folder.
export const WORKSPACE = "/workspace";

// Docker labels on a sandbox container: the service finds its own containers, their owner and expiry by them.
export const SANDBOX_LABEL = "powerloom.sandbox";
export const SANDBOX_OWNER_LABEL = "powerloom.owner";
export const SANDBOX_EXPIRES_LABEL = "powerloom.expires";

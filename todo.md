- [x] on no hover state, no white bg on the draw window when anything is drawn over so its transparenet as hte drawing itself will make it visible and also it will reduce visual clutter
    - Implemented dynamic transparency in `DrawingNode.tsx`. The canvas background becomes transparent when not being interacted with (not hovered/dragged/selected), reducing visual clutter.
- [x] allow ability to attach/send the drawing from a draw window to the context buffer and when that windows is turned to a chat that image is also sent to the ai to get a response.
    - Added an "Add to Context" button in `DrawingNode` toolbar.
    - Updated `InfiniteCanvas` to handle image attachments in context buffer.
    - Configured `ChatNode` to accept and display initial attachments when created from context.
- [x] when new chat is opend using context the previous context is and users query are sperate by a newline so taht user see thier question in teh first line not hte whole context and also the question input is focused already so taht user can start typing right away
    - Formatted `initialPrompt` to place context after newlines, keeping the top clear for user input.
    - Added auto-focus and cursor positioning (start of input) in `ChatNode` when initialized with context.





- [x] you have to make it fullstack and also do all the todo here
    - Added canvas state persistence API and restore flow.
- [x] also show the user that a image has been added to the context using a small uninstrusive viual cue  to the user
    - Added non-intrusive toast cue (`Image added to context`) and image icon badge in context chips.
- [x] search
    - Selection menu now preserves state while using Custom Ask input and no longer drops unexpectedly.
- [x] use lucide icons
    - Reused Lucide iconography for context image indicators in the top context bar.
- [x] chat bubble toggle transparency on non hover or forced
    - Bubble `Auto` mode now makes all bubble chrome transparent while keeping message text/icons visible.

- [x] make it fullstack
- [x] that means the canvas, chats are stored and restored, exxcept the images for now,
    - Added `/api/canvas-state` GET/POST persistence endpoint.
    - Added autosave/restore in `InfiniteCanvas` with image attachments stripped from persisted payloads.

- 
- [x] unsaved to restore
    - Added draft fallback restore from `localStorage` (`canvas-unsaved-state`) when server state is unavailable.
- [x] ui spacing fixx and consitentcy fix and anim fix
    - Tightened top dock/context sizing and standardized paddings across top controls and node headers.
- [x] move toast to bottom-right
- [x] add minimap toggle in settings

- non project realted animeted cursor in vscode and transprnet and cursive
- colour coding or clustering virtualization no priority
- rerender fix (optimize or make a svelte version) 
- exit animation for all in beautiful mode entry animation
- tags
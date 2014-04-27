Comixology backup
======

Do you like Comixology ( http://comixology.com )? Me too!

Are you annoyed that you can't download the comics you bought in a standard format, readable by all possible software? Me too!

So, I have written a Chrome/Chromium extension, that allows you to do just that. It should work on any OS where Chrome works.

(The extension is intended **just for back-uping** your comics collection on disk. Don't distribute the files or images anywhere else.)

Installation
-----

Because Google is retarded, the installation is slightly complicated (since I don't want to add this
to the Chrome Store). 
There are two ways of installing the extension.

### First possibility

The first way is [by this help page](https://support.google.com/chrome_webstore/answer/2664769?hl=en)

- In Chrome, click on the settings icon on the right (looks like three vertical lines on top of each other)
- Select Tools > Extensions
- **Drag and drop** the CRX file **from your disk** to the extension page
- Now you just open your comics in the Comixology reader and you should see an orange panel, asking for back-up.

### Second possibility

The second way is more or less the same, just without that retarded drag-and-drop

- In Chrome, click on the settings icon on the right (looks like three vertical lines on top of each other)
- Select Tools > Extensions
- Select "Developer mode"
- Click on "Load unpacked extension"
- Select the "source" folder
- Now you just open your comics in the Comixology reader and you should see an orange panel, asking for back-up.

### Why it's not on Chrome Store?

I am fairly certain Comixology will, unfortunately, try to remove this extension from Chrome Store, because
it goes around their DRM.

How it works
-----
You can look at the source code - but basically, it fetches the pixels of the canvas elements that compose to the opened page, puts them together, and then it downloads those again and zips them using zip.js.

Known troubles
-----
If the book is larger than 200-something pages, it never finishes. It's not my problem though, it's an issue with comixology that just stops loading images for some reason after about 200 pages. Probably some DRM issues, lel. And because I am just intercepting the requests, I never finish intercepting the end of the book.  
Note: This issue is intermittent.  Sometimes it works fine.

Sometimes the extension will get stuck on the first page and never go forward.  Refreshing the page and starting over usually gets around it.

About me, licence
----
The extension is made by SpergLord Enterprises, LLC, the leading provider in fun-based entertainment.

If you have problems with the software/have an idea, add an issue on github via Issues.

The code is under GPLv3 licence. Code uses JSZip by Stuart Knightley.

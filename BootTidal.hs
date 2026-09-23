-- Project boot file. The VS Code Tidal extension uses a BootTidal.hs in the
-- workspace root automatically (when tidalcycles.bootTidalPath is not set).
--
-- Tidal itself is already started by ~/.ghci (-> ~/.tidal/BootTidal.hs) on this
-- machine, so this file only adds the project's custom params.
-- On a machine without that ~/.ghci, paste the standard Tidal boot code
-- (import Sound.Tidal.Boot, tidalInst <- mkTidal, instance Tidally ...) above this line.

:script "/Users/uandha/ARP 2600/tidal/params.hs"

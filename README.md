Homestead Manager Applet
========================

Manage an installed Homestead instance from a panel menu.

Requirements
------------

* Installed, configured and working Homestead and Vagrant box instance in ~/Homestead
* Configuration options located in ~/.homestead

Usage
-----

* Homestead up/down
* Homestead status (Also indicated by the panel icon)
* Homestead provision
* Homestead SSH terminal
* Edit Homestead config

TODO
----

* Make calls async with callbacks
* Improve vagrant status check speed
* Check for box updates
* Provide user feedback during up/halt/suspend/destroy
* Show correct status for Up/Down/Suspended/Not Created
* Register applet in the Spices repository
* Add settings for the various editors and directories
* Make the file edit popup with the selected editor (xed by default on Mint)
* Select the correct size icon for the size of the taskbar
* Add more exception handling
* See if we can add unit testing for builds

# Roku BrightScript Atom Package

CORE:
---
1. Installation
To install Atom go to https://atom.io/ and follow instructions.
2. Go to ~/.atom/packages/ or C:\Users\user.name\.atom\packages
3. Create folder "atom_roku"
4. Copy all from plugin_source folder to atom_roku folder
5. Open terminal
6. cd to "atom_roku" folder and run command "apm install"
 - If apm not found:
    - Windows: add C:\Users\user.name\AppData\Local\atom\bin to Path
    - Linux and MacOS: Make link from atom\bin\apm dir to \usr\local\bin
7. Go to File/Settings and select Packages and find atom_roku in list to change IP.

Additional Packages:
---
1. Autocomplete+ provider for XML via XSD: [download autocomplete-xml](https://atom.io/packages/autocomplete-xml)

 >The XSD file follows the W3C standard. The XML file to autocomplete ask for validation.
 > That is, the root element must looks like: 
 
 ```<component name="SomeComponentName..." xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" extends="Scene" xsi:noNamespaceSchemaLocation="http://rokudev.roku.com/rokudev/schema/RokuSceneGraph.xsd">```

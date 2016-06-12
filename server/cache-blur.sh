#!/bin/bash

#
# settings
#
SOURCE="../covers/"
CACHE="cache/"
DESTINATION="blurred/"
LISTFILE="/tmp/artwork.files"
DATABASE="../database/artworks.sqlite3"

#
# building fullsize artwork list file
#
echo -n "[+] building list... "
echo "SELECT fullsize FROM artwork;" | sqlite3 $DATABASE > $LISTFILE

ITEMS=$(cat $LISTFILE | wc -l)
echo "$ITEMS files found"

cd $SOURCE

#
# foreach fullsize image
#
INDEX=1

while read i; do
	#
	# building blur version if not already exist
	#
	echo -en "\r[+] processing $INDEX/$ITEMS: checking..."
	
	if [ ! -f $DESTINATION/$i ]; then
		echo -e "\r[+] processing $INDEX/$ITEMS: $i"
		convert $CACHE/$i -modulate 100,20 -blur 0x8 -quality 90 $DESTINATION/$i
	fi
	
	INDEX=$(($INDEX + 1))

done < $LISTFILE

rm -f $LISTFILE

echo -e "\n[+] all done."

# remove the old deployment
if [ "$2" == "n" ];
then
  rm -rf ./deployments/.env."$1".json
fi
# begin a new one
yarn deploy:"$1"
# deploy the GRAPH
cd ./metadefender-subgraph || exit
yarn prepare:"$1"
yarn deploy-host:"$1"

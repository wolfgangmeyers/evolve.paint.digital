import * as React from "react";

export const CardHeader: React.FC = props => {
    return (
        <div className="card-header">
            {props.children}
        </div>
    );
};
